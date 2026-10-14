import { Prisma, type CommentAutoReply } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { friendlyMetaError, MetaApiError } from "@/lib/metaSocial";
import { adComments, facebookComments, instagramComments, mergeComments, privateReplyToComment, replyToComment, type CommentNetwork } from "@/lib/metaComments";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";

// ManyChat-style keyword answers for Facebook / Instagram comments. A new
// comment reaches handleIncomingComment from Meta's webhook (seconds) or from
// the sweep (every 10 minutes, and when someone opens Comentarios) in case a
// webhook never arrived. Each comment is answered at most once (the log row
// is claimed first), never by the AI: the texts are the owner's own.

export const MAX_RULES = 30;
const MAX_AUTO_REPLIES_PER_HOUR = 60;
// Comments older than this are left alone by the sweep (and nothing older
// than the rule itself is ever answered).
const SWEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 4 * 60 * 1000;

/** Lower-case, no accents, single spaces: "¡Quiero INFO!" → "¡quiero info!". */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Info, precio\nCUÁNTO vale" → ["info", "precio", "cuanto vale"]. */
export function parseKeywords(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,\n;]/)) {
    const k = normalizeText(raw).replace(/^#/, "").slice(0, 60);
    if (k && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 20);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match, so "info" answers "Info por favor" but not "informal". */
export function hasKeyword(text: string, keywords: string[]): boolean {
  const t = normalizeText(text);
  return keywords.some((k) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(k)}($|[^\\p{L}\\p{N}])`, "u").test(t));
}

type RuleLike = Pick<CommentAutoReply, "id" | "keywords" | "networks" | "enabled" | "createdAt">;

/** The oldest enabled rule for this network whose keyword is in the comment. */
export function matchRule<R extends RuleLike>(rules: R[], network: CommentNetwork, text: string): R | null {
  return (
    [...rules]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .find((r) => r.enabled && r.networks.includes(network) && hasKeyword(text, r.keywords)) ?? null
  );
}

/** {nombre} → the person's first name (or @usuario on Instagram). */
export function fillTemplate(template: string, authorName: string | null): string {
  const name = !authorName ? "" : authorName.startsWith("@") ? authorName : authorName.split(/\s+/)[0];
  return template
    .replace(/\{nombre\}/gi, name)
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export type IncomingComment = {
  network: CommentNetwork;
  commentId: string;
  text: string;
  authorName: string | null;
  createdAt: Date;
};

type Connection = { businessId: string; fbPageId: string; pageAccessToken: string };

export type AutoReplyOutcome = "no_match" | "duplicate" | "limited" | "sent" | "partial" | "failed";

/** Answers one new comment if a rule matches (idempotent per comment). */
export async function handleIncomingComment(
  connection: Connection,
  comment: IncomingComment,
  rules?: CommentAutoReply[],
): Promise<AutoReplyOutcome> {
  const all = rules ?? (await prisma.commentAutoReply.findMany({ where: { businessId: connection.businessId, enabled: true } }));
  const rule = matchRule(
    all.filter((r) => r.createdAt.getTime() <= comment.createdAt.getTime() + 60_000),
    comment.network,
    comment.text,
  );
  if (!rule) return "no_match";

  const limitKey = `comment-auto:${connection.businessId}`;
  if (await isRateLimited(limitKey, MAX_AUTO_REPLIES_PER_HOUR, 60 * 60 * 1000)) {
    console.warn("[comment auto-reply] hourly cap reached", connection.businessId);
    return "limited";
  }
  // Claim the comment before calling Meta: the webhook and the sweep can
  // both see it, and Meta retries webhooks.
  try {
    await prisma.commentAutoReplyLog.create({
      data: {
        businessId: connection.businessId,
        ruleId: rule.id,
        commentId: comment.commentId,
        network: comment.network,
        author: comment.authorName?.slice(0, 120) ?? null,
        comment: comment.text.slice(0, 1000),
        status: "pending",
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "duplicate";
    throw err;
  }
  await recordRateLimitEvent(limitKey);

  const pageToken = decryptSecret(connection.pageAccessToken);
  const errors: string[] = [];
  let sent = 0;
  const attempts = (rule.publicReplies.length ? 1 : 0) + (rule.privateMessage ? 1 : 0);
  if (rule.publicReplies.length) {
    try {
      await replyToComment({ network: comment.network, commentId: comment.commentId, text: fillTemplate(pick(rule.publicReplies), comment.authorName), pageToken });
      sent++;
    } catch (err) {
      console.error("[comment auto-reply] public reply failed", err);
      errors.push(`Respuesta pública: ${friendlyMetaError(err, "Meta no la dejó publicar")}`);
    }
  }
  if (rule.privateMessage) {
    try {
      await privateReplyToComment({ pageId: connection.fbPageId, commentId: comment.commentId, text: fillTemplate(rule.privateMessage, comment.authorName), pageToken });
      sent++;
    } catch (err) {
      console.error("[comment auto-reply] private reply failed", err);
      errors.push(`Mensaje privado: ${friendlyMetaError(err, "Meta no lo dejó enviar")}`);
    }
  }
  const status: AutoReplyOutcome = sent === 0 ? "failed" : sent < attempts ? "partial" : "sent";
  await prisma.$transaction([
    prisma.commentAutoReplyLog.update({
      where: { businessId_commentId: { businessId: connection.businessId, commentId: comment.commentId } },
      data: { status, error: errors.join(" · ").slice(0, 500) || null },
    }),
    ...(sent > 0
      ? [
          prisma.commentAutoReply.update({ where: { id: rule.id }, data: { replyCount: { increment: 1 }, lastTriggeredAt: new Date() } }),
          // Answered: it leaves "Sin responder" in Comentarios.
          prisma.socialThreadState.upsert({
            where: { businessId_conversationId: { businessId: connection.businessId, conversationId: comment.commentId } },
            create: { businessId: connection.businessId, conversationId: comment.commentId, network: comment.network, resolvedAt: new Date() },
            update: { resolvedAt: new Date() },
          }),
        ]
      : []),
  ]);
  return status;
}

/**
 * Backstop for missed webhooks: reads each business's latest comments and
 * answers the new ones that match a rule. Throttled per business.
 */
export async function sweepCommentAutoReplies(options: { businessIds?: string[]; force?: boolean } = {}): Promise<{ businesses: number; answered: number }> {
  const connections = await prisma.socialConnection.findMany({
    where: {
      ...(options.businessIds && { businessId: { in: options.businessIds } }),
      fbPageId: { not: null },
      pageAccessToken: { not: null },
      business: { commentAutoReplies: { some: { enabled: true } } },
    },
    select: { businessId: true, fbPageId: true, igUserId: true, pageAccessToken: true, adAccountId: true, userAccessToken: true },
    take: 100,
  });
  let answered = 0;
  for (const c of connections) {
    const key = `comment-sweep:${c.businessId}`;
    if (!options.force && (await isRateLimited(key, 1, SWEEP_EVERY_MS))) continue;
    await recordRateLimitEvent(key);
    try {
      answered += await sweepBusiness({
        businessId: c.businessId,
        fbPageId: c.fbPageId!,
        pageAccessToken: c.pageAccessToken!,
        igUserId: c.igUserId,
        adAccountId: c.adAccountId,
        userAccessToken: c.userAccessToken,
      });
    } catch (err) {
      console.error("[comment auto-reply] sweep failed", c.businessId, err);
    }
  }
  return { businesses: connections.length, answered };
}

async function sweepBusiness(c: Connection & { igUserId: string | null; adAccountId: string | null; userAccessToken: string | null }): Promise<number> {
  const rules = await prisma.commentAutoReply.findMany({ where: { businessId: c.businessId, enabled: true } });
  const networks = new Set(rules.flatMap((r) => r.networks));
  const pageToken = decryptSecret(c.pageAccessToken);
  const [fb, ig, ads] = await Promise.all([
    networks.has("facebook") ? facebookComments(c.fbPageId, pageToken) : [],
    networks.has("instagram") && c.igUserId ? instagramComments(c.igUserId, pageToken) : [],
    // Comments on ads ("Comenta INFO" campaigns) live on their own, often hidden, posts.
    c.adAccountId && c.userAccessToken
      ? adComments({ adAccountId: c.adAccountId, userToken: decryptSecret(c.userAccessToken), pageId: c.fbPageId, igUserId: c.igUserId, pageToken }).catch((err) => {
          console.error("[comment auto-reply] ad comments failed", c.businessId, err);
          return [];
        })
      : [],
  ]);
  const since = Date.now() - SWEEP_LOOKBACK_MS;
  const fresh = mergeComments([...fb, ...ig], ads.filter((m) => networks.has(m.network))).filter(
    (m) => !m.answered && !m.hidden && Date.parse(m.createdAt) >= since,
  );
  if (fresh.length === 0) return 0;
  const done = await prisma.commentAutoReplyLog.findMany({
    where: { businessId: c.businessId, commentId: { in: fresh.map((m) => m.id) } },
    select: { commentId: true },
  });
  const seen = new Set(done.map((d) => d.commentId));
  let answered = 0;
  for (const m of fresh) {
    if (seen.has(m.id)) continue;
    const outcome = await handleIncomingComment(
      c,
      { network: m.network, commentId: m.id, text: m.text, authorName: m.authorName.startsWith("Alguien") ? null : m.authorName, createdAt: new Date(m.createdAt) },
      rules,
    );
    if (outcome === "sent" || outcome === "partial") answered++;
    if (outcome === "limited") break;
  }
  return answered;
}

/**
 * Asks Meta to send this Page's new comments to our webhook. Instagram
 * comments ride on the same Page subscription. Best effort: the sweep still
 * answers within minutes if this fails.
 */
export async function subscribePageToComments(pageId: string, pageToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`);
    url.searchParams.set("subscribed_fields", "feed,messages");
    url.searchParams.set("access_token", pageToken);
    const res = await fetch(url, { method: "POST", cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string; code?: number } };
    if (!res.ok || json.error) throw new MetaApiError(json.error?.message ?? `Meta respondió ${res.status}`, json.error?.code);
    return { ok: true };
  } catch (err) {
    console.error("[comment auto-reply] page subscription failed", err);
    return { ok: false, error: friendlyMetaError(err) };
  }
}

/** Who is connected to a Page / Instagram account (several businesses could share one). */
export async function connectionsFor(where: { fbPageId: string } | { igUserId: string }) {
  const rows = await prisma.socialConnection.findMany({ where, select: { businessId: true, fbPageId: true, pageAccessToken: true } });
  return rows.filter((r): r is Connection => !!r.fbPageId && !!r.pageAccessToken);
}

// ---- Webhook payload ----

export type WebhookComment = { where: { fbPageId: string } | { igUserId: string }; comment: IncomingComment };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : undefined);

/** New top-level comments by other people, in Meta's webhook payload. */
export function commentsInPayload(payload: unknown): WebhookComment[] {
  const body = rec(payload);
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const out: WebhookComment[] = [];
  for (const e of entries) {
    const entry = rec(e);
    const ownerId = str(entry?.id);
    if (!ownerId) continue;
    for (const c of Array.isArray(entry?.changes) ? entry.changes : []) {
      const change = rec(c);
      const value = rec(change?.value);
      if (!value) continue;
      const from = rec(value.from);
      if (body?.object === "page" && change?.field === "feed") {
        const commentId = str(value.comment_id);
        // Only new comments on a post (not replies inside a thread), not the Page's own.
        if (value.item !== "comment" || value.verb !== "add" || !commentId || value.parent_id !== value.post_id || from?.id === ownerId) continue;
        const created = typeof value.created_time === "number" ? new Date(value.created_time * 1000) : new Date();
        out.push({
          where: { fbPageId: ownerId },
          comment: { network: "facebook", commentId, text: str(value.message) ?? "", authorName: str(from?.name) ?? null, createdAt: created },
        });
      } else if (body?.object === "instagram" && change?.field === "comments") {
        const commentId = str(value.id);
        if (!commentId || value.parent_id || from?.id === ownerId) continue;
        const username = str(from?.username);
        out.push({
          where: { igUserId: ownerId },
          comment: { network: "instagram", commentId, text: str(value.text) ?? "", authorName: username ? `@${username}` : null, createdAt: new Date() },
        });
      }
    }
  }
  return out;
}
