import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import {
  sendWhatsAppTextMessage,
  sendWhatsAppMediaMessage,
  fetchWhatsAppMediaMeta,
  downloadWhatsAppMedia,
  type WhatsAppInboundMessage,
} from "@/lib/whatsapp";
import { uploadAttachment } from "@/lib/attachments";
import { generateAgentReply, type AgentHistoryMessage, type AgentReplyUsage } from "@/lib/ai";
import { getActiveContactsThisMonth, getAccountActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS } from "@/lib/plans";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Imagen",
  audio: "Nota de voz",
  document: "Documento",
  video: "Video",
};

const HISTORY_LIMIT = 20;

/**
 * Handles one inbound WhatsApp text message end to end: persists it, asks the
 * business's AI agent for a reply, sends that reply back over WhatsApp, and
 * persists the reply too. Runs independently per message so one failure
 * (e.g. a business with no agent configured yet) never blocks the others.
 */
export async function handleIncomingMessage(message: WhatsAppInboundMessage): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { wabaPhoneNumberId: message.phoneNumberId },
    include: { agent: true },
  });

  if (!business || !business.wabaAccessToken) {
    console.warn(`No business configured for phone_number_id ${message.phoneNumberId}`);
    return;
  }

  if (!business.agent?.enabled) {
    console.warn(`AI agent disabled or not configured for business ${business.id}`);
    return;
  }

  // Decrypted once and reused for both the inbound media download below and
  // the outbound reply send further down.
  const accessToken = decryptSecret(business.wabaAccessToken);

  // Background context (city/country/social media/phone) the owner set once
  // in "Mi perfil" — fed into the prompt automatically, see buildSystemPrompt.
  const ownerMembership = await prisma.membership.findFirst({
    where: { businessId: business.id, role: "OWNER" },
    include: {
      user: {
        select: { phone: true, city: true, country: true, facebook: true, instagram: true, tiktok: true, linkedin: true },
      },
    },
  });

  // Only needed for a brand-new conversation — every business is seeded with
  // its own default pipeline on creation, so this should always find one. A
  // business can have several pipelines (funnels), e.g. one per salesperson
  // (see the Pipeline model) — every new inbound conversation lands in the
  // DEFAULT one first; a team member then claims it into their own funnel by
  // moving it to one of their stages.
  const firstStage = await prisma.pipelineStage.findFirst({
    where: { businessId: business.id, pipeline: { isDefault: true } },
    orderBy: { position: "asc" },
  });
  if (!firstStage) {
    console.warn(`Business ${business.id} has no default pipeline configured`);
    return;
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      businessId_customerPhone: { businessId: business.id, customerPhone: message.from },
    },
    update: { customerName: message.contactName, lastMessageAt: new Date() },
    create: {
      businessId: business.id,
      customerPhone: message.from,
      customerName: message.contactName,
      stageId: firstStage.id,
    },
  });

  // Most recent N messages, not the oldest N: `take` with an ascending sort
  // would otherwise return the very start of the conversation once it grows
  // past HISTORY_LIMIT, freezing the agent's memory at the first ~20
  // messages ever exchanged instead of sliding forward with the chat.
  const previousMessagesDesc = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const previousMessages = previousMessagesDesc.reverse();

  // Every AI reply costs real money (see lib/ai.ts), so an account that's
  // already at its plan's monthly active-contacts cap shouldn't get billed
  // for yet another one. Checked BEFORE saving this message so an already-
  // active contact this month (someone mid-conversation) is never affected —
  // only a genuinely NEW contact arriving after the cap is reached gets
  // paused, which matches what "Hasta N contactos activos/mes" promises on
  // the pricing page.
  //
  // Pooled across every line (business) the account owns, not just this one
  // — one subscription can cover multiple WhatsApp lines (see LINE_LIMITS),
  // so the cap has to be account-wide or a multi-line account could reach
  // several times the intended contact volume for one plan's price.
  const planLimit = PLAN_LIMITS[business.planTier];
  let overPlanLimit = false;
  if (planLimit !== null) {
    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const alreadyActiveThisMonth = await prisma.message.findFirst({
      where: { conversationId: conversation.id, role: "CUSTOMER", createdAt: { gte: startOfMonth } },
      select: { id: true },
    });
    if (!alreadyActiveThisMonth) {
      const activeContacts = ownerMembership
        ? await getAccountActiveContactsThisMonth(ownerMembership.userId)
        : await getActiveContactsThisMonth(business.id);
      if (activeContacts >= planLimit) overPlanLimit = true;
    }
  }

  // Media arrives from Meta as a short-lived id (its download URL expires
  // within minutes), so it has to be fetched and re-hosted on our own
  // storage right away, before this message row is even written — the AI
  // never "sees" the file itself (no vision call here), it only gets a
  // plain-text placeholder in its history so the conversation still reads
  // naturally if the owner scrolls back or the agent references it.
  let messageContent = message.text;
  let mediaFields: {
    mediaUrl?: string;
    mediaType?: string;
    mediaMimeType?: string;
    mediaFilename?: string;
    mediaSizeBytes?: number;
  } = {};

  if (message.media) {
    try {
      const meta = await fetchWhatsAppMediaMeta({ mediaId: message.media.mediaId, accessToken });
      if (meta) {
        const bytes = await downloadWhatsAppMedia({ url: meta.url, accessToken });
        const filename = message.media.filename ?? `${message.media.type}-${message.media.mediaId}`;
        const { url, size } = await uploadAttachment({ bytes, filename, contentType: meta.mimeType });
        mediaFields = {
          mediaUrl: url,
          mediaType: message.media.type,
          mediaMimeType: meta.mimeType,
          mediaFilename: message.media.filename,
          mediaSizeBytes: size,
        };
      }
    } catch (err) {
      console.error("Failed to fetch/store inbound WhatsApp media:", err);
    }
    if (!messageContent) {
      const label = MEDIA_TYPE_LABEL[message.media.type] ?? "Adjunto";
      messageContent = mediaFields.mediaUrl
        ? `[${label}${message.media.filename ? `: ${message.media.filename}` : ""}]`
        : "[Adjunto recibido — no se pudo procesar]";
    }
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: messageContent,
      whatsappMsgId: message.whatsappMsgId,
      ...mediaFields,
    },
  });

  if (conversation.aiPaused) {
    // A human already took over this specific conversation — the message is
    // saved above so it shows up in the dashboard, but the AI stays quiet
    // instead of talking over them.
    return;
  }

  if (overPlanLimit) {
    // Saved above so it's visible in the dashboard, but no AI call — pause
    // this conversation for a human to pick up (or the plan to be upgraded)
    // instead of quietly going over the plan's cost ceiling.
    await logPlanLimitNotice(conversation.id, planLimit!);
    await prisma.conversation.update({ where: { id: conversation.id }, data: { aiPaused: true } });
    return;
  }

  const history: AgentHistoryMessage[] = previousMessages.map((msg) => ({
    role: msg.role === "CUSTOMER" ? "user" : "assistant",
    content: msg.content,
  }));

  const availableMedia = await prisma.agentMedia.findMany({
    where: { businessId: business.id },
    select: { id: true, label: true, mediaType: true },
  });

  let reply: string;
  let usage: AgentReplyUsage;
  let sendMediaId: string | undefined;
  try {
    const result = await generateAgentReply({
      systemPrompt: business.agent.systemPrompt,
      tone: business.agent.tone,
      replyLength: business.agent.replyLength,
      industry: business.industry,
      model: business.agent.model,
      history,
      userMessage: message.text,
      owner: ownerMembership?.user,
      availableMedia,
    });
    reply = result.text;
    usage = result.usage;
    sendMediaId = result.sendMediaId;
  } catch (err) {
    // Surface the failure straight into the conversation thread in the
    // dashboard — a plain, ASCII-only summary, since the raw error object
    // has repeatedly broken the platform's own log viewer before we could
    // read it there. Tagged so we know it happened during the Claude call.
    await logInternalError(conversation.id, "IA", err);
    throw err;
  }

  try {
    const media = sendMediaId ? await prisma.agentMedia.findUnique({ where: { id: sendMediaId } }) : null;

    const { messageId } = media
      ? await sendWhatsAppMediaMessage({
          phoneNumberId: business.wabaPhoneNumberId!,
          accessToken,
          to: message.from,
          type: media.mediaType as "image" | "document",
          link: media.url,
          // Meta caps an image/document caption well under a plain text
          // message's limit — truncated so a "detallada" reply never gets
          // rejected outright when it's riding along with a file.
          caption: reply ? reply.slice(0, 900) : undefined,
          filename: media.mediaType === "document" ? (media.filename ?? undefined) : undefined,
        })
      : await sendWhatsAppTextMessage({
          phoneNumberId: business.wabaPhoneNumberId!,
          accessToken,
          to: message.from,
          // Only reachable with an empty reply if Claude replied with just a
          // tool call and the referenced media vanished between generation
          // and send (deleted mid-flight) — an empty WhatsApp text send
          // would otherwise fail outright.
          text: reply || "Un momento, ya te cuento.",
        });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "AGENT",
        content: reply,
        whatsappMsgId: messageId,
        model: business.agent.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        ...(media && {
          mediaUrl: media.url,
          mediaType: media.mediaType,
          mediaFilename: media.filename,
          mediaSizeBytes: media.sizeBytes,
        }),
      },
    });
  } catch (err) {
    // Tagged so we know it happened during the WhatsApp send, not the
    // Claude call above.
    await logInternalError(conversation.id, "WHATSAPP", err);
    throw err;
  }
}

async function logPlanLimitNotice(conversationId: string, planLimit: number): Promise<void> {
  await prisma.message.create({
    data: {
      conversationId,
      role: "AGENT",
      content: `[LÍMITE DE PLAN] Este negocio alcanzó su límite de ${planLimit} contactos activos este mes. La IA se pausó automáticamente en esta conversación para evitar sobrecostos — respondan manualmente o actualicen de plan para reactivarla (botón de IA en la conversación).`,
    },
  });
}

async function logInternalError(conversationId: string, tag: string, err: unknown): Promise<void> {
  const raw = err instanceof Error ? err.message : String(err);
  const safeMessage = raw.replace(/[^\x20-\x7E]/g, "?").slice(0, 500);
  await prisma.message.create({
    data: {
      conversationId,
      role: "AGENT",
      content: `[ERROR INTERNO - ${tag}] ${safeMessage}`,
    },
  });
}
