import { prisma } from "@/lib/prisma";
import { sendPushToBusiness } from "@/lib/push";
import { getAccountAddonCapacity } from "@/lib/addons";
import { AI_REPLY_LIMITS, AI_REPLY_OVERFLOW, CONTACT_DAILY_AI_REPLIES, REPLIES_PER_EXTRA_CONTACT } from "@/lib/plans";
import type { PlanTier } from "@prisma/client";

// Keeps every account inside the AI cost its plan was priced for (see
// AI_REPLY_LIMITS in lib/plans.ts). An "AI reply" is an AGENT message that
// came from a model call (it has `model` set); human replies and internal
// notices don't count.

export type ReplyBudgetMode = "normal" | "economy" | "paused";

/** Under the limit: normal. Up to AI_REPLY_OVERFLOW past it: the economical model. Beyond: paused. */
export function replyBudgetMode(used: number, limit: number | null): ReplyBudgetMode {
  if (limit === null) return "normal";
  if (used < limit) return "normal";
  if (used < Math.round(limit * (1 + AI_REPLY_OVERFLOW))) return "economy";
  return "paused";
}

const DAILY_NOTICE = "[LÍMITE DE PLAN] Diario";

function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The account's monthly AI reply allowance, including bought packs. Null = unlimited. */
async function accountReplyLimit(planTier: PlanTier, ownerUserId: string | null): Promise<number | null> {
  const base = AI_REPLY_LIMITS[planTier];
  if (base === null) return null;
  const extraContacts = ownerUserId ? (await getAccountAddonCapacity(ownerUserId)).extraContacts : 0;
  return base + extraContacts * REPLIES_PER_EXTRA_CONTACT;
}

async function accountBusinessIds(businessId: string, ownerUserId: string | null): Promise<string[]> {
  if (!ownerUserId) return [businessId];
  const owned = await prisma.membership.findMany({ where: { userId: ownerUserId, role: "OWNER" }, select: { businessId: true } });
  return owned.length > 0 ? owned.map((m) => m.businessId) : [businessId];
}

export async function aiRepliesThisMonth(businessIds: string[]): Promise<number> {
  return prisma.message.count({
    where: { role: "AGENT", model: { not: null }, createdAt: { gte: monthStart() }, conversation: { businessId: { in: businessIds } } },
  });
}

/** One notification per type per business per month. */
async function notifyOnce(businessId: string, type: string, message: string, title: string): Promise<void> {
  const already = await prisma.notification.findFirst({ where: { businessId, type, createdAt: { gte: monthStart() } }, select: { id: true } });
  if (already) return;
  await prisma.notification.create({ data: { businessId, type, message } });
  await sendPushToBusiness(businessId, { title, body: message, url: `/dashboard/businesses/${businessId}`, tag: `${type}-${businessId}` }).catch(() => {});
}

/** A chat paused by the daily per-contact cap more than 24 hours ago gets its AI back. */
export async function pausedOnlyByExpiredDailyCap(conversationId: string): Promise<boolean> {
  const last = await prisma.message.findFirst({
    where: { conversationId, role: "AGENT", content: { startsWith: "[LÍMITE DE PLAN]" } },
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true },
  });
  return !!last && last.content.startsWith(DAILY_NOTICE) && Date.now() - last.createdAt.getTime() >= 24 * 60 * 60 * 1000;
}

/**
 * Before each AI reply: may this conversation get one, and on which model?
 * "skip" never tells the customer anything; the business is notified.
 */
export async function checkReplyBudget(params: {
  businessId: string;
  businessName: string;
  planTier: PlanTier;
  conversationId: string;
  contactLabel: string;
}): Promise<"normal" | "economy" | "skip"> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const contactReplies = await prisma.message.count({
    where: { conversationId: params.conversationId, role: "AGENT", model: { not: null }, createdAt: { gte: dayAgo } },
  });
  if (contactReplies >= CONTACT_DAILY_AI_REPLIES) {
    await prisma.$transaction([
      prisma.conversation.update({ where: { id: params.conversationId }, data: { aiPaused: true } }),
      prisma.message.create({
        data: {
          conversationId: params.conversationId,
          role: "AGENT",
          content: `${DAILY_NOTICE}: la IA ya respondió ${CONTACT_DAILY_AI_REPLIES} veces a este cliente en las últimas 24 horas, así que te pasó la conversación para que sigas tú. Se reactiva sola mañana, o antes con el botón de IA de la conversación.`,
        },
      }),
      prisma.notification.create({
        data: {
          businessId: params.businessId,
          conversationId: params.conversationId,
          type: "AI_CONTACT_DAILY_CAP",
          message: `✋ ${params.contactLabel} lleva muchos mensajes hoy: tu agente te pasó la conversación para que la sigas tú.`,
        },
      }),
    ]);
    return "skip";
  }

  const owner = await prisma.membership.findFirst({ where: { businessId: params.businessId, role: "OWNER" }, select: { userId: true } });
  const ownerUserId = owner?.userId ?? null;
  const limit = await accountReplyLimit(params.planTier, ownerUserId);
  if (limit === null) return "normal";
  const used = await aiRepliesThisMonth(await accountBusinessIds(params.businessId, ownerUserId));
  const mode = replyBudgetMode(used, limit);

  if (used >= limit * 0.8) {
    await notifyOnce(
      params.businessId,
      "AI_REPLIES_80",
      `Tu agente ya usó el 80% de sus respuestas de IA de este mes (${used.toLocaleString("es-CO")} de ${limit.toLocaleString("es-CO")}). Si vas a necesitar más, agrega un paquete desde tu panel.`,
      `⚠️ 80% de respuestas de IA usadas · ${params.businessName}`,
    );
  }
  if (mode === "paused") {
    await notifyOnce(
      params.businessId,
      "AI_REPLIES_PAUSED",
      "Tu agente llegó al máximo de respuestas de IA de este mes y dejó de responder. Tus clientes siguen escribiendo al CRM: respóndeles a mano o agrega un paquete para reactivarlo al instante.",
      `⛔ Tu agente de IA se pausó · ${params.businessName}`,
    );
    return "skip";
  }
  return mode;
}
