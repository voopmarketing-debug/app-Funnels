import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { VISION_MEDIA_TYPES, type VisionImage } from "@/lib/ai";
import { MAX_REPLY_ATTEMPTS, alertReplyGaveUp, replyToConversation, type ReplyContext } from "@/lib/agent";

// Safety net behind the live webhook flow: finds chats where a customer
// wrote and never got an answer — the AI or WhatsApp failed, the function
// timed out mid-reply, or Meta accepted our reply and later reported it
// undelivered — and tries again, up to MAX_REPLY_ATTEMPTS per customer
// message. Runs opportunistically (every webhook delivery and dashboard
// poll, throttled per business) plus a cron endpoint, so it doesn't depend
// on any one scheduler.

const NOTICE = /^\[(ERROR INTERNO|LÍMITE DE PLAN)/;
// Leaves the live handler time to finish before a sweep steps in.
const MIN_AGE_MS = 60 * 1000;
const ATTEMPT_COOLDOWN_MS = 2 * 60 * 1000;
// Free-form replies are only allowed inside Meta's 24h customer-service window.
const WINDOW_MS = 23 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;
const MAX_VISION_IMAGE_BYTES = 3.5 * 1024 * 1024;
const SWEEP_THROTTLE_MS = 60 * 1000;

// Delivery failures a resend can't fix (window closed, number not on
// WhatsApp, account/payment problems) — those get an alert, not a retry.
const PERMANENT_DELIVERY_ERRORS = new Set([131026, 131031, 131042, 131045, 131047, 131049, 131051]);

async function refetchVisionImage(url: string, mimeType: string | null): Promise<VisionImage | undefined> {
  const baseMime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  const visionMime = VISION_MEDIA_TYPES.find((t) => t === baseMime);
  if (!visionMime) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_VISION_IMAGE_BYTES) return undefined;
    return { mediaType: visionMime, data: bytes.toString("base64") };
  } catch {
    return undefined;
  }
}

type SweepResult = { checked: number; retried: number; failed: number };

/** Retries unanswered chats. `businessIds` limits the sweep (webhook/dashboard triggers); omit for all businesses (cron). */
export async function retryPendingReplies(options: { businessIds?: string[]; limit?: number } = {}): Promise<SweepResult> {
  const now = Date.now();
  const candidates = await prisma.conversation.findMany({
    where: {
      ...(options.businessIds && { businessId: { in: options.businessIds } }),
      aiPaused: false,
      replyAttempts: { lt: MAX_REPLY_ATTEMPTS },
      lastMessageAt: { gte: new Date(now - WINDOW_MS) },
      OR: [{ lastReplyAttemptAt: null }, { lastReplyAttemptAt: { lt: new Date(now - ATTEMPT_COOLDOWN_MS) } }],
      business: { agent: { enabled: true }, wabaAccessToken: { not: null }, wabaPhoneNumberId: { not: null } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: options.limit ?? 25,
    include: { business: { include: { agent: true } } },
  });

  const result: SweepResult = { checked: candidates.length, retried: 0, failed: 0 };
  for (const conversation of candidates) {
    try {
      const acted = await recoverConversation(conversation, now);
      if (acted) result.retried++;
    } catch (err) {
      result.failed++;
      console.error(`Reply recovery failed for conversation ${conversation.id}:`, err);
    }
  }
  return result;
}

type Candidate = Prisma.ConversationGetPayload<{ include: { business: { include: { agent: true } } } }>;

async function recoverConversation(conversation: Candidate, now: number, manual = false): Promise<boolean> {
  const { business } = conversation;
  if (!business.agent || !business.wabaAccessToken || !business.wabaPhoneNumberId) return false;

  const recentDesc = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT + 5,
  });
  const latestIdx = recentDesc.findIndex((m) => !(m.role === "AGENT" && NOTICE.test(m.content)));
  if (latestIdx === -1) return false;
  const latest = recentDesc[latestIdx];
  if (!manual && latest.role === "CUSTOMER" && now - latest.createdAt.getTime() < MIN_AGE_MS) return false;

  // Claim the conversation first (optimistic lock on the attempt timestamp)
  // so two concurrent sweeps can never both answer it.
  const claim = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      OR: [{ lastReplyAttemptAt: null }, { lastReplyAttemptAt: { lt: new Date(now - ATTEMPT_COOLDOWN_MS) } }],
    },
    data: { lastReplyAttemptAt: new Date() },
  });
  if (claim.count === 0) return false;

  const accessToken = decryptSecret(business.wabaAccessToken);

  // Case 1: the customer's last message never got an answer.
  if (latest.role === "CUSTOMER") {
    const previousMessages = recentDesc
      .slice(latestIdx + 1)
      .slice(0, HISTORY_LIMIT)
      .reverse();
    const owner = await prisma.membership.findFirst({
      where: { businessId: business.id, role: "OWNER" },
      select: {
        user: {
          select: { phone: true, city: true, country: true, facebook: true, instagram: true, tiktok: true, linkedin: true },
        },
      },
    });
    const image =
      latest.mediaType === "image" && latest.mediaUrl ? await refetchVisionImage(latest.mediaUrl, latest.mediaMimeType) : undefined;
    const ctx: ReplyContext = {
      business: { ...business, agent: business.agent },
      conversation,
      accessToken,
      owner: owner?.user,
      previousMessages,
      userMessage: image && /^\[Imagen/.test(latest.content) ? "" : latest.content,
      userImages: image ? [image] : undefined,
      replyAsVoiceNote: latest.mediaType === "audio",
      to: conversation.customerPhone,
    };
    await replyToConversation(ctx);
    return true;
  }

  // Case 2: our reply was accepted but Meta later reported it undelivered.
  if (latest.role === "AGENT" && latest.deliveryStatus === "failed" && !latest.broadcastId) {
    const code = Number(latest.deliveryError?.match(/\((\d{3,6})\)/)?.[1]);
    if (PERMANENT_DELIVERY_ERRORS.has(code)) return false;

    const tracked = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { replyAttempts: { increment: 1 } },
      select: { replyAttempts: true },
    });
    try {
      const { messageId } =
        latest.mediaUrl && latest.mediaType
          ? await sendWhatsAppMediaMessage({
              phoneNumberId: business.wabaPhoneNumberId,
              accessToken,
              to: conversation.customerPhone,
              type: latest.mediaType as "image" | "document" | "audio" | "video",
              link: latest.mediaUrl,
              caption: latest.content ? latest.content.slice(0, 900) : undefined,
              filename: latest.mediaFilename ?? undefined,
            })
          : await sendWhatsAppTextMessage({
              phoneNumberId: business.wabaPhoneNumberId,
              accessToken,
              to: conversation.customerPhone,
              text: latest.content || "Un momento, ya te cuento.",
            });
      await prisma.message.update({
        where: { id: latest.id },
        data: { whatsappMsgId: messageId, deliveryStatus: null, deliveryStatusAt: null, deliveryError: null },
      });
    } catch (err) {
      if (tracked.replyAttempts >= MAX_REPLY_ATTEMPTS) {
        await alertReplyGaveUp(
          {
            business: { ...business, agent: business.agent },
            conversation,
            accessToken,
            owner: undefined,
            previousMessages: [],
            userMessage: "",
            replyAsVoiceNote: false,
            to: conversation.customerPhone,
          },
          err,
        );
      }
      throw err;
    }
    return true;
  }

  return false;
}

/**
 * Cheap trigger for webhook deliveries and dashboard polling: runs a sweep
 * for these businesses at most once a minute each (claimed in the database,
 * so concurrent serverless instances don't pile up).
 */
export async function maybeRetryPendingReplies(businessIds: string[]): Promise<void> {
  if (businessIds.length === 0) return;
  const cutoff = new Date(Date.now() - SWEEP_THROTTLE_MS);
  const due: string[] = [];
  for (const id of businessIds) {
    const claimed = await prisma.business.updateMany({
      where: { id, OR: [{ lastReplySweepAt: null }, { lastReplySweepAt: { lt: cutoff } }] },
      data: { lastReplySweepAt: new Date() },
    });
    if (claimed.count > 0) due.push(id);
  }
  if (due.length > 0) await retryPendingReplies({ businessIds: due, limit: 10 });
}

/**
 * "Reintentar respuesta" in the chat: the business asked to try again now
 * (e.g. right after topping up the Anthropic balance), so the attempt budget
 * and cooldown are reset and the same recovery runs immediately.
 */
export async function retryConversationNow(conversationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.conversation.update({ where: { id: conversationId }, data: { replyAttempts: 0, lastReplyAttemptAt: null } });
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { business: { include: { agent: true } } },
  });
  if (!conversation) return { ok: false, error: "Conversación no encontrada" };
  if (Date.now() - conversation.lastMessageAt.getTime() > WINDOW_MS) {
    return { ok: false, error: "Pasaron más de 24 h desde su último mensaje: WhatsApp solo permite escribirle con una plantilla." };
  }
  try {
    const acted = await recoverConversation(conversation, Date.now(), true);
    return acted ? { ok: true } : { ok: false, error: "No hay ningún mensaje pendiente de respuesta en este chat." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "No se pudo responder" };
  }
}
