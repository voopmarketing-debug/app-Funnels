import { prisma } from "@/lib/prisma";
import { sendPushToBusiness } from "@/lib/push";
import { MAX_CATALOG_PRODUCTS } from "@/lib/inventory";
import { isSubscriptionActive } from "@/lib/subscription";
import { decryptSecret } from "@/lib/crypto";
import {
  sendWhatsAppTextMessage,
  sendWhatsAppMediaMessage,
  fetchWhatsAppMediaMeta,
  downloadWhatsAppMedia,
  type WhatsAppInboundMessage,
} from "@/lib/whatsapp";
import { uploadAttachment } from "@/lib/attachments";
import {
  generateAgentReply,
  VISION_MEDIA_TYPES,
  type AgentHistoryMessage,
  type AgentReplyUsage,
  type OwnerContext,
  type VisionImage,
} from "@/lib/ai";
import type { AIAgent, Business, Conversation, Message } from "@prisma/client";
import { synthesizeVoiceNote, transcribeVoiceNote } from "@/lib/tts";
import { withAiUsage } from "@/lib/aiUsage";
import { getActiveContactsThisMonth, getAccountActiveContactsThisMonth } from "@/lib/analytics";
import { getAccountAddonCapacity } from "@/lib/addons";
import { ECONOMY_AGENT_MODEL, PLAN_LIMITS } from "@/lib/plans";
import { checkReplyBudget, pausedOnlyByExpiredDailyCap } from "@/lib/aiReplyBudget";
import { contactLabel } from "@/lib/contactDisplay";
import { bookedStageAfter, resolveAutoStageMove, type FunnelStage } from "@/lib/autoStage";
import { isWonStageName } from "@/lib/sales";
import Anthropic from "@anthropic-ai/sdk";
import { describeAnthropicError } from "@/lib/aiServiceHealth";
import { reportWebhookProblem } from "@/lib/whatsappHealth";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Imagen",
  audio: "Nota de voz",
  document: "Documento",
  video: "Video",
};

const HISTORY_LIMIT = 20;
// Customers often send a thought in several quick messages ("hola", "quiero
// info", "precio?"). Waiting this long and answering only the latest one
// (with the others in the history) gives one reply instead of three.
const BURST_WINDOW_MS = 4000;

// Claude's per-image cap is 5 MB after base64 encoding (~33% larger than the
// raw bytes) — bigger photos still reach the AI, just as a text placeholder.
const MAX_VISION_IMAGE_BYTES = 3.5 * 1024 * 1024;

function formatAppointmentDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

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

  // Meta's webhook delivery is "at least once" — if our processing (Claude
  // call + WhatsApp send) takes long enough that Meta doesn't get its ack in
  // time, it retries the same message, which would otherwise run the entire
  // pipeline twice (duplicate AI reply, duplicate appointment notification,
  // etc.). Bail out early if we've already stored this exact message.
  if (message.whatsappMsgId) {
    const alreadyProcessed = await prisma.message.findFirst({
      where: { whatsappMsgId: message.whatsappMsgId },
      select: { id: true },
    });
    if (alreadyProcessed) {
      console.warn(`Skipping duplicate webhook delivery for whatsappMsgId ${message.whatsappMsgId}`);
      return;
    }
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
    update: { lastMessageAt: new Date() },
    create: {
      businessId: business.id,
      customerPhone: message.from,
      customerName: message.contactName,
      stageId: firstStage.id,
    },
  });
  // The WhatsApp profile name only fills an EMPTY name — once the business
  // has named the contact itself (lead panel, "Agregar contacto", CSV
  // import), their name wins over whatever the customer's profile says.
  if (!conversation.customerName?.trim() && message.contactName?.trim()) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { customerName: message.contactName } });
  }

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
      // Contact packs bought on top of the plan (see lib/addons.ts) raise
      // the cap the moment their payment is approved.
      const extraContacts = ownerMembership ? (await getAccountAddonCapacity(ownerMembership.userId)).extraContacts : 0;
      if (activeContacts >= planLimit + extraContacts) overPlanLimit = true;
    }
  }

  // Media arrives from Meta as a short-lived id (its download URL expires
  // within minutes), so it has to be fetched and re-hosted on our own
  // storage right away, before this message row is even written. A photo
  // is also handed to the AI as real vision input for THIS reply (see
  // inboundImage); in the stored history it's just a text placeholder.
  let messageContent = message.text;
  let inboundImage: VisionImage | null = null;
  let mediaFields: {
    mediaUrl?: string;
    mediaType?: string;
    mediaMimeType?: string;
    mediaFilename?: string;
    mediaSizeBytes?: number;
  } = {};
  // Drives whether the reply goes out as a voice note too (see below) — only
  // when the customer actually spoke to the agent, not just because a voice
  // note happens to exist somewhere earlier in the conversation.
  let inboundWasVoiceNote = false;

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

        const baseMime = meta.mimeType.split(";")[0].trim().toLowerCase();
        const visionMime = VISION_MEDIA_TYPES.find((t) => t === baseMime);
        if (message.media.type === "image" && visionMime && bytes.length <= MAX_VISION_IMAGE_BYTES) {
          inboundImage = { mediaType: visionMime, data: bytes.toString("base64") };
        }

        if (message.media.type === "audio") {
          inboundWasVoiceNote = true;
          // Meta never sends a caption for voice notes, so without this the
          // AI would see an empty message and have no idea what was said.
          try {
            const transcript = await withAiUsage(business.id, "VOICE_IN", () =>
              transcribeVoiceNote({ bytes, mimeType: meta.mimeType }),
            );
            if (transcript) messageContent = transcript;
          } catch (err) {
            console.error("Failed to transcribe inbound voice note:", err);
          }
        }
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

  const savedInbound = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: messageContent,
      whatsappMsgId: message.whatsappMsgId,
      ...mediaFields,
    },
  });
  // A new customer message gets a fresh reply-retry budget (see replyToConversation).
  await prisma.conversation.update({ where: { id: conversation.id }, data: { replyAttempts: 0 } });

  // Fires on every inbound customer message, independent of whether the AI
  // ends up replying (paused conversation, over plan limit, etc.) — those
  // are exactly the cases where a human most needs to know someone wrote in,
  // since the agent won't respond on its own.
  {
    const leadLabel = contactLabel(conversation.customerName, conversation.customerPhone);
    const excerpt = messageContent.length > 80 ? `${messageContent.slice(0, 80)}...` : messageContent;
    // First time this person writes in: a new chat, flagged as such.
    const isNewChat = !previousMessages.some((m) => m.role === "CUSTOMER");
    await prisma.notification.create({
      data: {
        businessId: business.id,
        conversationId: conversation.id,
        type: isNewChat ? "NEW_CONVERSATION" : "NEW_MESSAGE",
        message: isNewChat ? `💬 Nuevo chat de ${leadLabel}: "${excerpt}"` : `${leadLabel} te escribió: "${excerpt}"`,
      },
    });
    // Push to the owner's devices for every customer message (like Kommo),
    // worded by what it needs: a new chat, one the AI won't answer on its
    // own (paused, switched off, over the limit), or a regular message.
    // Tagged by conversation, so a chatty contact replaces their previous
    // notification instead of stacking a dozen.
    const needsHuman = conversation.aiPaused || !business.agent?.enabled || overPlanLimit;
    await sendPushToBusiness(business.id, {
      title: isNewChat
        ? `💬 Nuevo chat · ${business.name}`
        : needsHuman
          ? `✋ ${leadLabel} espera respuesta`
          : `💬 ${leadLabel} · ${business.name}`,
      body: isNewChat ? `${leadLabel}: ${excerpt}` : excerpt,
      url: `/dashboard/businesses/${business.id}/conversations/${conversation.id}`,
      tag: conversation.id,
    }).catch((err) => console.error("[push] new-message push failed", err));
  }

  // Agent switched off ("Agente apagado") or never configured: the message
  // is still saved and notified above, so the business sees who wrote in
  // and can answer by hand — it just gets no AI reply. (This used to return
  // before saving anything, so with the agent off, new messages never even
  // reached the CRM.)
  if (!business.agent?.enabled) {
    console.warn(`AI agent disabled or not configured for business ${business.id}; message saved without AI reply`);
    return;
  }

  // A contact paused only because LAST month's plan limit ran out gets the
  // AI back once a new month starts: the monthly quota has renewed.
  if (conversation.aiPaused && ((await pausedOnlyByPastMonthLimit(conversation.id)) || (await pausedOnlyByExpiredDailyCap(conversation.id)))) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { aiPaused: false } });
    conversation.aiPaused = false;
  }

  if (conversation.aiPaused) {
    // A human already took over this specific conversation — the message is
    // saved above so it shows up in the dashboard, but the AI stays quiet
    // instead of talking over them.
    return;
  }

  if (!isSubscriptionActive(business.subscriptionEndsAt)) {
    // Paid period over: the message is saved above (nothing is lost while
    // they renew), but no AI reply is paid for. Not marked aiPaused, so the
    // agent picks up again on its own the moment the subscription renews.
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

  // More messages from this customer on the way? The latest one answers them all.
  await new Promise((resolve) => setTimeout(resolve, BURST_WINDOW_MS));
  const newer = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: "CUSTOMER", createdAt: { gt: savedInbound.createdAt } },
    select: { id: true },
  });
  if (newer) return;

  await replyToConversation({
    business: { ...business, agent: business.agent },
    conversation,
    accessToken,
    owner: ownerMembership?.user,
    previousMessages,
    // Never message.text directly: for a voice note that's always empty
    // (messageContent holds the transcript), and for a photo sent without
    // a caption it's empty too — an empty user turn is rejected outright
    // by the API. A caption-less photo passes "" on purpose: generateAgentReply
    // then labels it as "sent without text" next to the actual image.
    userMessage: inboundImage && !message.text.trim() ? "" : messageContent,
    userImages: inboundImage ? [inboundImage] : undefined,
    replyAsVoiceNote: inboundWasVoiceNote,
    to: message.from,
  });
}

export type ReplyContext = {
  business: Business & { agent: AIAgent };
  conversation: Conversation;
  accessToken: string;
  owner: OwnerContext | undefined;
  // Conversation history BEFORE the message being answered.
  previousMessages: Message[];
  userMessage: string;
  userImages?: VisionImage[];
  replyAsVoiceNote: boolean;
  to: string;
};

export const MAX_REPLY_ATTEMPTS = 3;

/**
 * Generates and sends the AI reply, tracking attempts on the conversation so
 * lib/replyRecovery.ts can retry a reply that failed (AI error, WhatsApp
 * send error, or a later "failed" delivery report) — and so two runs never
 * answer the same message at the same time. The counter is per customer
 * message: it resets when a new one arrives (handleIncomingMessage), not on
 * a send Meta accepted, since a send can still be reported "failed" later —
 * that keeps retries bounded. After MAX_REPLY_ATTEMPTS the business is
 * alerted to answer by hand.
 */
export async function replyToConversation(ctx: ReplyContext): Promise<void> {
  // The plan's AI budget (lib/aiReplyBudget.ts) is checked here so the
  // retry sweep (lib/replyRecovery.ts) goes through it too.
  const budget = await checkReplyBudget({
    businessId: ctx.business.id,
    businessName: ctx.business.name,
    planTier: ctx.business.planTier,
    conversationId: ctx.conversation.id,
    contactLabel: contactLabel(ctx.conversation.customerName, ctx.conversation.customerPhone),
  });
  if (budget === "skip") return;
  const model = budget === "economy" ? ECONOMY_AGENT_MODEL : undefined;

  const tracked = await prisma.conversation.update({
    where: { id: ctx.conversation.id },
    data: { replyAttempts: { increment: 1 }, lastReplyAttemptAt: new Date() },
    select: { replyAttempts: true },
  });
  try {
    await generateAndSendReply(ctx, model);
  } catch (err) {
    if (tracked.replyAttempts >= MAX_REPLY_ATTEMPTS) {
      await alertReplyGaveUp(ctx, err).catch(() => {});
    }
    throw err;
  }
}

async function moveLeadStage(ctx: ReplyContext, target: FunnelStage): Promise<void> {
  const { business, conversation } = ctx;
  // Conditional on the stage we read: if someone on the team moved the lead
  // in the meantime, their choice wins.
  const moved = await prisma.conversation.updateMany({
    where: { id: conversation.id, businessId: business.id, stageId: conversation.stageId },
    data: { stageId: target.id },
  });
  if (moved.count === 0) return;
  console.log(`[agent] moved conversation ${conversation.id} to stage "${target.name}"`);
  if (!isWonStageName(target.name)) return;

  // A sale needs a human to confirm the payment and the amount, so the AI
  // only flags it: the notification opens the chat, where "Registrar venta"
  // is one tap away.
  const leadLabel = contactLabel(conversation.customerName, conversation.customerPhone);
  await prisma.notification.create({
    data: {
      businessId: business.id,
      conversationId: conversation.id,
      type: "LEAD_WON",
      message: `🎉 ${leadLabel} confirmó su compra. Tu agente lo pasó a "${target.name}": verifica el pago y registra la venta.`,
    },
  });
  await sendPushToBusiness(business.id, {
    title: `🎉 ${leadLabel} compró · ${business.name}`,
    body: "Verifica el pago y registra la venta en el CRM.",
    url: `/dashboard/businesses/${business.id}/conversations/${conversation.id}`,
    tag: `won-${conversation.id}`,
  }).catch((err) => console.error("[push] won push failed", err));
}

export async function alertReplyGaveUp(ctx: ReplyContext, err: unknown): Promise<void> {
  const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  await prisma.notification.create({
    data: {
      businessId: ctx.business.id,
      conversationId: ctx.conversation.id,
      type: "WHATSAPP_ALERT",
      message: `⚠ No se pudo responder a ${contactLabel(ctx.conversation.customerName, ctx.conversation.customerPhone)} después de ${MAX_REPLY_ATTEMPTS} intentos (${reason}). Respóndele manualmente desde el CRM.`,
    },
  });
}

async function generateAndSendReply(ctx: ReplyContext, modelOverride?: string): Promise<void> {
  const { business, conversation, accessToken } = ctx;
  // Internal error / plan-limit notices are stored as AGENT messages so they
  // show in the dashboard, but they were never sent to the customer — feeding
  // them back as the agent's own past replies would confuse the model (and
  // it might start imitating raw error text).
  const history: AgentHistoryMessage[] = ctx.previousMessages
    .filter((msg) => !(msg.role === "AGENT" && /^\[(ERROR INTERNO|LÍMITE DE PLAN)/.test(msg.content)))
    .map((msg) => ({
      role: msg.role === "CUSTOMER" ? "user" : "assistant",
      content: msg.content,
    }));

  const [availableMedia, products, funnelStages] = await Promise.all([
    prisma.agentMedia.findMany({
      where: { businessId: business.id },
      select: { id: true, label: true, mediaType: true },
    }),
    // The catalog the agent quotes from: availability only, never units.
    prisma.product.findMany({
      where: { businessId: business.id, active: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: MAX_CATALOG_PRODUCTS,
      select: { name: true, price: true, compareAtPrice: true, currency: true, category: true, description: true, trackStock: true, stock: true, kind: true },
    }),
    // The stages of the funnel this lead is in, so the agent can move it.
    prisma.pipelineStage.findMany({
      where: { pipeline: { stages: { some: { id: conversation.stageId } } } },
      orderBy: { position: "asc" },
      select: { id: true, name: true, position: true },
    }),
  ]);
  const currentStage = funnelStages.find((st) => st.id === conversation.stageId);
  const stageNames = Array.from(new Set(funnelStages.map((st) => st.name)));
  const catalog = products.map(({ trackStock, stock, kind, ...p }) => ({ ...p, soldOut: trackStock && stock <= 0, isService: kind === "SERVICE" }));

  let reply: string;
  let usage: AgentReplyUsage;
  let sendMediaId: string | undefined;
  try {
    const result = await generateAgentReply({
      systemPrompt: business.agent.systemPrompt,
      tone: business.agent.tone,
      replyLength: business.agent.replyLength,
      industry: business.industry,
      model: modelOverride ?? business.agent.model,
      history,
      // Never message.text directly: for a voice note that's always empty
      // (messageContent holds the transcript), and for a photo sent without
      // a caption it's empty too — an empty user turn is rejected outright
      // by the API, which is exactly how caption-less photos used to fail
      // with "user messages must have non-empty content" and get no reply.
      // (A caption-less photo passes "" here on purpose: generateAgentReply
      // then labels it as "sent without text" next to the actual image,
      // instead of the stored "[Imagen]" placeholder.)
      userMessage: ctx.userMessage,
      userImages: ctx.userImages,
      owner: ctx.owner,
      availableMedia,
      catalog,
      funnel: currentStage ? { stages: stageNames, current: currentStage.name } : undefined,
    });
    reply = result.text;
    usage = result.usage;
    sendMediaId = result.sendMediaId;

    // The AI detected the customer confirming a concrete date/time for a
    // meeting (see the mark_appointment tool in lib/ai.ts) — fill in the
    // "Cita agendada" field in the lead's detail panel automatically instead
    // of leaving it for the business owner to type in by hand, and let them
    // know via the notification bell. Skipped if nothing actually changed
    // (the AI can re-confirm the same appointment across several messages),
    // so re-confirming an unchanged appointment doesn't spam a new notice.
    if (result.appointment) {
      const appointmentAt = new Date(result.appointment.at);
      const changed =
        conversation.appointmentAt?.getTime() !== appointmentAt.getTime() ||
        conversation.appointmentNote !== result.appointment.note;
      if (changed) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { appointmentAt, appointmentNote: result.appointment.note },
        });
        const leadLabel = contactLabel(conversation.customerName, conversation.customerPhone);
        await prisma.notification.create({
          data: {
            businessId: business.id,
            conversationId: conversation.id,
            type: "APPOINTMENT_SCHEDULED",
            message: `${leadLabel} agendó una cita para ${formatAppointmentDate(appointmentAt)}`,
          },
        });
      }
    }

    // Keep the CRM funnel current without anyone dragging cards: the stage
    // the AI chose, or else the funnel's "Agendado"-type stage when it just
    // booked an appointment. Never fails the reply.
    const target =
      (result.stage ? resolveAutoStageMove(funnelStages, conversation.stageId, result.stage) : null) ??
      (result.appointment ? bookedStageAfter(funnelStages, conversation.stageId) : null);
    if (target) {
      await moveLeadStage(ctx, target).catch((err) => console.error("[agent] auto stage move failed", err));
    }
  } catch (err) {
    // Surface the failure straight into the conversation thread in the
    // dashboard — a plain, ASCII-only summary, since the raw error object
    // has repeatedly broken the platform's own log viewer before we could
    // read it there. Tagged so we know it happened during the Claude call.
    await logInternalError(conversation.id, "IA", err);
    // A billing/key problem blocks EVERY reply, not just this one — alert
    // right away (throttled) instead of waiting for the daily health check.
    const described = describeAnthropicError(err);
    if (described.billing || err instanceof Anthropic.AuthenticationError) {
      await reportWebhookProblem(business.id, `La IA no pudo responder. ${described.text}`).catch(() => {});
    }
    throw err;
  }

  try {
    const toolMedia = sendMediaId ? await prisma.agentMedia.findUnique({ where: { id: sendMediaId } }) : null;

    // Only when the customer actually spoke (voice note in) and the AI isn't
    // already sending a file via the send_media tool — a reply never carries
    // both a tool attachment and a synthesized voice note at once. A TTS
    // failure here just falls back to a normal text reply instead of losing
    // the message entirely.
    let voiceNote: { url: string; sizeBytes: number } | null = null;
    if (!toolMedia && ctx.replyAsVoiceNote && reply) {
      try {
        const audioBytes = await withAiUsage(business.id, "VOICE_OUT", () => synthesizeVoiceNote(reply));
        const { url, size } = await uploadAttachment({
          bytes: audioBytes,
          filename: `respuesta-${Date.now()}.ogg`,
          // Must include the codecs param — see the matching comment in
          // actions.ts's sendManualMessage — or WhatsApp accepts the send
          // but the recipient's phone can't play it back.
          contentType: "audio/ogg; codecs=opus",
        });
        voiceNote = { url, sizeBytes: size };
      } catch (err) {
        console.error("Failed to synthesize outbound voice note, falling back to text:", err);
      }
    }

    const { messageId } = toolMedia
      ? await sendWhatsAppMediaMessage({
          phoneNumberId: business.wabaPhoneNumberId!,
          accessToken,
          to: ctx.to,
          type: toolMedia.mediaType as "image" | "document",
          link: toolMedia.url,
          // Meta caps an image/document caption well under a plain text
          // message's limit — truncated so a "detallada" reply never gets
          // rejected outright when it's riding along with a file.
          caption: reply ? reply.slice(0, 900) : undefined,
          filename: toolMedia.mediaType === "document" ? (toolMedia.filename ?? undefined) : undefined,
        })
      : voiceNote
        ? await sendWhatsAppMediaMessage({
            phoneNumberId: business.wabaPhoneNumberId!,
            accessToken,
            to: ctx.to,
            type: "audio",
            link: voiceNote.url,
          })
        : await sendWhatsAppTextMessage({
            phoneNumberId: business.wabaPhoneNumberId!,
            accessToken,
            to: ctx.to,
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
        model: modelOverride ?? business.agent.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        ...(toolMedia && {
          mediaUrl: toolMedia.url,
          mediaType: toolMedia.mediaType,
          mediaFilename: toolMedia.filename,
          mediaSizeBytes: toolMedia.sizeBytes,
        }),
        ...(voiceNote && {
          mediaUrl: voiceNote.url,
          mediaType: "audio",
          mediaSizeBytes: voiceNote.sizeBytes,
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

/**
 * True when the last plan-limit notice on this conversation is from a
 * previous calendar month (and none this month), i.e. the AI was paused by
 * the monthly quota, not by a person.
 */
async function pausedOnlyByPastMonthLimit(conversationId: string): Promise<boolean> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastNotice = await prisma.message.findFirst({
    where: { conversationId, role: "AGENT", content: { startsWith: "[LÍMITE DE PLAN]" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return !!lastNotice && lastNotice.createdAt < startOfMonth;
}

async function logPlanLimitNotice(conversationId: string, planLimit: number): Promise<void> {
  await prisma.message.create({
    data: {
      conversationId,
      role: "AGENT",
      content: `[LÍMITE DE PLAN] Este negocio alcanzó su límite de ${planLimit} clientes atendidos por IA este mes. La IA se pausó automáticamente en esta conversación para evitar sobrecostos — respondan manualmente o actualicen de plan para reactivarla (botón de IA en la conversación).`,
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
