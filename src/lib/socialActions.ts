"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireBusinessMembership, requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { friendlyMetaError, listAdAccounts, listPages } from "@/lib/metaSocial";
import { isConversationId, sendReply, threadParticipantIds } from "@/lib/metaInbox";
import { invalidateInboxCache } from "@/lib/inboxCache";
import { THREAD_ACTIONS, threadPatch, type ThreadAction } from "@/lib/threadState";
import { isCommentId, privateReplyToComment, replyToComment, setCommentHidden, type CommentNetwork } from "@/lib/metaComments";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { MAX_RULES, parseKeywords, subscribePageToComments, sweepCommentAutoReplies } from "@/lib/commentAutoReply";
import { clearSocialCache, getAdsSection, getSocialDashboard } from "@/lib/socialDashboard";
import { RANGE_PRESETS, todayInColombia } from "@/lib/socialRanges";
import { MIN_POSTS, generateContentDiagnosis as runContentDiagnosis, type AdsInput, type ContentDiagnosis } from "@/lib/contentDiagnosis";
import { withAiUsage } from "@/lib/aiUsage";

async function userId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Inicia sesión de nuevo");
  return session.user.id;
}

/**
 * Saves which Facebook Page (with its Instagram) and which ad account this
 * business reports on. The Page token is read again from Meta here, never
 * taken from the browser.
 */
export async function selectSocialAccounts(
  businessId: string,
  pageId: string | null,
  adAccountId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  const connection = await prisma.socialConnection.findUnique({ where: { businessId } });
  if (!connection?.userAccessToken) return { ok: false, error: "Conecta tu cuenta de Facebook primero" };
  const token = decryptSecret(connection.userAccessToken);
  try {
    const [pages, adAccounts] = await Promise.all([pageId ? listPages(token) : [], adAccountId ? listAdAccounts(token) : []]);
    const page = pageId ? pages.find((p) => p.id === pageId) : null;
    const ad = adAccountId ? adAccounts.find((a) => a.id === adAccountId) : null;
    if (pageId && !page) return { ok: false, error: "Esa página ya no aparece en tu cuenta de Facebook" };
    if (adAccountId && !ad) return { ok: false, error: "Esa cuenta publicitaria ya no aparece en tu Facebook" };
    await prisma.socialConnection.update({
      where: { businessId },
      data: {
        fbPageId: page?.id ?? null,
        fbPageName: page?.name ?? null,
        pageAccessToken: page ? encryptSecret(page.accessToken) : null,
        igUserId: page?.igUserId ?? null,
        igUsername: page?.igUsername ?? null,
        adAccountId: ad?.id ?? null,
        adAccountName: ad?.name ?? null,
        adCurrency: ad?.currency ?? null,
      },
    });
  } catch (err) {
    console.error("[social] select accounts failed", err);
    return { ok: false, error: "Meta no respondió. Intenta de nuevo en un momento." };
  }
  await clearSocialCache(businessId, true);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
  return { ok: true };
}

export async function refreshSocialData(businessId: string): Promise<{ ok: boolean }> {
  await requireBusinessMembership(await userId(), businessId);
  const cleared = await clearSocialCache(businessId);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
  revalidatePath(`/dashboard/businesses/${businessId}/redes/anuncios`);
  return { ok: cleared };
}

export async function disconnectSocial(businessId: string): Promise<void> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  await prisma.socialConnection.deleteMany({ where: { businessId } });
  await clearSocialCache(businessId, true);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
}

export type ContentDiagnosisResult =
  | { status: "ok"; diagnosis: ContentDiagnosis; generatedAt: string; range: string }
  | { status: "insufficient_data"; posts: number }
  | { status: "error"; message: string };

// A fresh report is only worth it once new posts have had time to get numbers.
const DIAGNOSIS_COOLDOWN_MS = 10 * 60 * 1000;

export async function generateContentDiagnosis(businessId: string): Promise<ContentDiagnosisResult> {
  await requireBusinessMembership(await userId(), businessId);
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { contentDiagnosisAt: true } });
  if (!connection) return { status: "error", message: "Conecta tus redes primero." };
  if (connection.contentDiagnosisAt && Date.now() - connection.contentDiagnosisAt.getTime() < DIAGNOSIS_COOLDOWN_MS) {
    return { status: "error", message: "Acabas de generar un diagnóstico. Espera unos minutos antes de pedir otro." };
  }

  try {
    // The last 30 days, or 90 when the business posts rarely.
    const today = todayInColombia();
    const preset = (key: string) => RANGE_PRESETS.find((p) => p.key === key)!.range(today);
    let data = await getSocialDashboard(businessId, preset("30d"));
    if ((data.posts?.ok ? data.posts.data.length : 0) < MIN_POSTS) data = await getSocialDashboard(businessId, preset("3m"));
    if (data.needsReconnect) return { status: "error", message: "Tu conexión con Facebook venció. Reconéctala y vuelve a intentarlo." };
    if (data.throttled) return { status: "error", message: "Consultaste muchos periodos seguidos. Espera unos minutos y vuelve a intentarlo." };

    // Ads over the last 3 months, or the last year when nothing ran lately:
    // a paused campaign that worked is still the model for the next one.
    let ads: AdsInput | null = null;
    if (data.ads?.ok) {
      for (const key of ["3m", "12m"]) {
        const range = preset(key);
        const section = await getAdsSection(businessId, range);
        if (section.ads?.ok && section.ads.data.campaigns.some((c) => c.spend > 0)) {
          ads = { range, data: section.ads.data };
          break;
        }
      }
    }

    const result = await withAiUsage(businessId, "DIAGNOSIS", () => runContentDiagnosis(businessId, data, ads));
    if (result.status === "insufficient_data") return result;

    const generatedAt = new Date();
    await prisma.socialConnection.update({
      where: { businessId },
      data: { contentDiagnosis: { ...result.diagnosis, range: data.range }, contentDiagnosisAt: generatedAt },
    });
    revalidatePath(`/dashboard/businesses/${businessId}/redes`);
    return { status: "ok", diagnosis: result.diagnosis, generatedAt: generatedAt.toISOString(), range: `${data.range.since}|${data.range.until}` };
  } catch (err) {
    console.error("[social] content diagnosis failed", err);
    return { status: "error", message: "No se pudo generar el diagnóstico. Intenta de nuevo en un momento." };
  }
}

// ---- Mensajes (Messenger + Instagram Direct, answered by people) ----

const inboxPath = (businessId: string) => `/dashboard/businesses/${businessId}/redes/mensajes`;
const NETWORKS = new Set(["facebook", "instagram"]);

export async function sendSocialReply(
  businessId: string,
  thread: { conversationId: string; network: "facebook" | "instagram"; recipientId: string },
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBusinessMembership(await userId(), businessId);
  const body = text.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Escribe un mensaje" };
  if (!isConversationId(thread.conversationId) || !isConversationId(thread.recipientId) || !NETWORKS.has(thread.network)) {
    return { ok: false, error: "Esta conversación ya no está disponible. Recarga la página." };
  }
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { fbPageId: true, pageAccessToken: true } });
  if (!connection?.fbPageId || !connection.pageAccessToken) return { ok: false, error: "Conecta tu página de Facebook primero." };
  const pageToken = decryptSecret(connection.pageAccessToken);
  try {
    // The reply only goes to someone who is part of this Page's conversation:
    // the ids come from the browser, so they're checked against Meta.
    const participants = await threadParticipantIds(thread.conversationId, pageToken);
    if (!participants.includes(thread.recipientId)) {
      console.warn("[social] reply blocked: recipient not in conversation", { businessId });
      return { ok: false, error: "Esta conversación ya no está disponible. Recarga la página." };
    }
    await sendReply({ pageId: connection.fbPageId, pageToken, recipientId: thread.recipientId, text: body });
  } catch (err) {
    console.error("[social] reply failed", err);
    return { ok: false, error: friendlyMetaError(err, "Meta no dejó enviar el mensaje. Intenta de nuevo en un momento.") };
  }
  // Answering a thread reads it and puts it back in the open list.
  await prisma.socialThreadState.upsert({
    where: { businessId_conversationId: { businessId, conversationId: thread.conversationId } },
    create: { businessId, conversationId: thread.conversationId, network: thread.network, readAt: new Date() },
    update: { readAt: new Date() },
  });
  await invalidateInboxCache(businessId);
  revalidatePath(inboxPath(businessId));
  return { ok: true };
}

/** The "three dots" menu of a conversation: read / unread, answered, closed (see lib/threadState.ts). */
export async function updateSocialThread(
  businessId: string,
  thread: { conversationId: string; network: "facebook" | "instagram" },
  action: ThreadAction,
): Promise<void> {
  await requireBusinessMembership(await userId(), businessId);
  if (!isConversationId(thread.conversationId) || !NETWORKS.has(thread.network) || !THREAD_ACTIONS.includes(action)) return;
  const patch = threadPatch(action, new Date());
  await prisma.socialThreadState.upsert({
    where: { businessId_conversationId: { businessId, conversationId: thread.conversationId } },
    create: { businessId, conversationId: thread.conversationId, network: thread.network, ...patch },
    update: patch,
  });
  revalidatePath(inboxPath(businessId));
}

// ---- Comentarios ----

const commentsPath = (businessId: string) => `/dashboard/businesses/${businessId}/redes/comentarios`;
// Generous for a team answering by hand; stops a runaway script from
// getting the Page flagged by Meta for spam.
const COMMENT_ACTIONS_PER_HOUR = 200;

type CommentAction =
  | { kind: "reply"; text: string }
  | { kind: "private"; text: string }
  | { kind: "hide"; hidden: boolean };

export async function actOnSocialComment(
  businessId: string,
  comment: { id: string; network: CommentNetwork },
  action: CommentAction,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBusinessMembership(await userId(), businessId);
  if (!isCommentId(comment.id) || !NETWORKS.has(comment.network)) return { ok: false, error: "Este comentario ya no está disponible. Recarga la página." };
  const text = action.kind === "hide" ? "" : action.text.trim().slice(0, 2000);
  if (action.kind !== "hide" && !text) return { ok: false, error: "Escribe una respuesta" };

  const limitKey = `social-comment:${businessId}`;
  if (await isRateLimited(limitKey, COMMENT_ACTIONS_PER_HOUR, 60 * 60 * 1000)) {
    return { ok: false, error: "Respondiste muchos comentarios en la última hora. Espera un rato para que Meta no lo tome como spam." };
  }
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { fbPageId: true, pageAccessToken: true } });
  if (!connection?.fbPageId || !connection.pageAccessToken) return { ok: false, error: "Conecta tu página de Facebook primero." };
  const pageToken = decryptSecret(connection.pageAccessToken);
  try {
    if (action.kind === "reply") await replyToComment({ network: comment.network, commentId: comment.id, text, pageToken });
    else if (action.kind === "private") await privateReplyToComment({ pageId: connection.fbPageId, commentId: comment.id, text, pageToken });
    else await setCommentHidden({ network: comment.network, commentId: comment.id, hidden: action.hidden, pageToken });
  } catch (err) {
    console.error(`[social] comment ${action.kind} failed`, err);
    return { ok: false, error: friendlyMetaError(err, "Meta no dejó hacerlo ahora. Intenta de nuevo en un momento.") };
  }
  await recordRateLimitEvent(limitKey);
  // Answering (publicly or in private) settles the comment.
  if (action.kind !== "hide") await markCommentDone(businessId, comment, true);
  revalidatePath(commentsPath(businessId));
  return { ok: true };
}

async function markCommentDone(businessId: string, comment: { id: string; network: CommentNetwork }, done: boolean): Promise<void> {
  // Same table as the DM inbox: a comment id never collides with a conversation id.
  await prisma.socialThreadState.upsert({
    where: { businessId_conversationId: { businessId, conversationId: comment.id } },
    create: { businessId, conversationId: comment.id, network: comment.network, readAt: new Date(), resolvedAt: done ? new Date() : null },
    update: { resolvedAt: done ? new Date() : null },
  });
}

/** "Listo" for comments that need no answer (an emoji, a tag to a friend). */
export async function setSocialCommentDone(businessId: string, comment: { id: string; network: CommentNetwork }, done: boolean): Promise<void> {
  await requireBusinessMembership(await userId(), businessId);
  if (!isCommentId(comment.id) || !NETWORKS.has(comment.network)) return;
  await markCommentDone(businessId, comment, done);
  revalidatePath(commentsPath(businessId));
}

// ---- Respuestas automáticas (keyword rules) ----

const autoRepliesPath = (businessId: string) => `/dashboard/businesses/${businessId}/redes/comentarios/automaticas`;

export type AutoReplyInput = {
  name: string;
  keywords: string;
  networks: string[];
  publicReplies: string[];
  privateMessage: string;
};

function cleanRule(input: AutoReplyInput): { ok: true; data: { name: string; keywords: string[]; networks: string[]; publicReplies: string[]; privateMessage: string | null } } | { ok: false; error: string } {
  const keywords = parseKeywords(input.keywords ?? "");
  const networks = (Array.isArray(input.networks) ? input.networks : []).filter((n) => NETWORKS.has(n));
  const publicReplies = (Array.isArray(input.publicReplies) ? input.publicReplies : [])
    .map((r) => String(r).trim().slice(0, 1000))
    .filter(Boolean)
    .slice(0, 5);
  const privateMessage = (input.privateMessage ?? "").trim().slice(0, 1000) || null;
  if (keywords.length === 0) return { ok: false, error: "Escribe al menos una palabra clave" };
  if (networks.length === 0) return { ok: false, error: "Elige Facebook, Instagram o ambas" };
  if (publicReplies.length === 0 && !privateMessage) return { ok: false, error: "Escribe la respuesta pública, el mensaje privado o ambos" };
  const name = (input.name ?? "").trim().slice(0, 60) || keywords[0].toUpperCase();
  return { ok: true, data: { name, keywords, networks, publicReplies, privateMessage } };
}

export async function saveCommentAutoReply(
  businessId: string,
  ruleId: string | null,
  input: AutoReplyInput,
): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  const clean = cleanRule(input);
  if (!clean.ok) return clean;
  if (ruleId) {
    const updated = await prisma.commentAutoReply.updateMany({ where: { id: ruleId, businessId }, data: clean.data });
    if (updated.count === 0) return { ok: false, error: "Esta regla ya no existe. Recarga la página." };
  } else {
    if ((await prisma.commentAutoReply.count({ where: { businessId } })) >= MAX_RULES) {
      return { ok: false, error: `Puedes tener hasta ${MAX_RULES} reglas. Borra alguna que ya no uses.` };
    }
    await prisma.commentAutoReply.create({ data: { businessId, ...clean.data } });
  }
  // Ask Meta to notify new comments right away (the 10-minute sweep covers the rest).
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { fbPageId: true, pageAccessToken: true } });
  let warning: string | undefined;
  if (connection?.fbPageId && connection.pageAccessToken) {
    const sub = await subscribePageToComments(connection.fbPageId, decryptSecret(connection.pageAccessToken));
    if (!sub.ok) warning = `La regla quedó guardada y responderá en máximo 10 minutos. Para que sea al instante: ${sub.error}`;
  } else {
    warning = "La regla quedó guardada, pero primero conecta tu página de Facebook para que empiece a responder.";
  }
  revalidatePath(autoRepliesPath(businessId));
  return { ok: true, ...(warning ? { warning } : {}) };
}

export async function setCommentAutoReplyEnabled(businessId: string, ruleId: string, enabled: boolean): Promise<void> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  await prisma.commentAutoReply.updateMany({ where: { id: ruleId, businessId }, data: { enabled } });
  revalidatePath(autoRepliesPath(businessId));
}

export async function deleteCommentAutoReply(businessId: string, ruleId: string): Promise<void> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  await prisma.commentAutoReply.deleteMany({ where: { id: ruleId, businessId } });
  revalidatePath(autoRepliesPath(businessId));
}

/** "Revisar ahora": answers matching comments without waiting for the next sweep. */
export async function runCommentAutoRepliesNow(businessId: string): Promise<{ answered: number }> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  const key = `comment-sweep-manual:${businessId}`;
  if (await isRateLimited(key, 6, 60 * 60 * 1000)) return { answered: 0 };
  await recordRateLimitEvent(key);
  const res = await sweepCommentAutoReplies({ businessIds: [businessId], force: true });
  revalidatePath(autoRepliesPath(businessId));
  revalidatePath(commentsPath(businessId));
  return { answered: res.answered };
}
