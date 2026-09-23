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
import { synthesizeVoiceNote, transcribeVoiceNote } from "@/lib/tts";
import { getActiveContactsThisMonth, getAccountActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS } from "@/lib/plans";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Imagen",
  audio: "Nota de voz",
  document: "Documento",
  video: "Video",
};

const HISTORY_LIMIT = 20;

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

  if (!business.agent?.enabled) {
    console.warn(`AI agent disabled or not configured for business ${business.id}`);
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

        if (message.media.type === "audio") {
          inboundWasVoiceNote = true;
          // Meta never sends a caption for voice notes, so without this the
          // AI would see an empty message and have no idea what was said.
          try {
            const transcript = await transcribeVoiceNote({ bytes, mimeType: meta.mimeType });
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

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: messageContent,
      whatsappMsgId: message.whatsappMsgId,
      ...mediaFields,
    },
  });

  // Fires on every inbound customer message, independent of whether the AI
  // ends up replying (paused conversation, over plan limit, etc.) — those
  // are exactly the cases where a human most needs to know someone wrote in,
  // since the agent won't respond on its own.
  {
    const leadLabel = conversation.customerName || conversation.customerPhone;
    const excerpt = messageContent.length > 80 ? `${messageContent.slice(0, 80)}...` : messageContent;
    await prisma.notification.create({
      data: {
        businessId: business.id,
        conversationId: conversation.id,
        type: "NEW_MESSAGE",
        message: `${leadLabel} te escribió: "${excerpt}"`,
      },
    });
  }

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
      // For a voice note this is the transcript (see above) — message.text
      // itself is always empty for audio, Meta never sends a caption on it.
      userMessage: inboundWasVoiceNote ? messageContent : message.text,
      owner: ownerMembership?.user,
      availableMedia,
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
        const leadLabel = conversation.customerName || conversation.customerPhone;
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
  } catch (err) {
    // Surface the failure straight into the conversation thread in the
    // dashboard — a plain, ASCII-only summary, since the raw error object
    // has repeatedly broken the platform's own log viewer before we could
    // read it there. Tagged so we know it happened during the Claude call.
    await logInternalError(conversation.id, "IA", err);
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
    if (!toolMedia && inboundWasVoiceNote && reply) {
      try {
        const audioBytes = await synthesizeVoiceNote(reply);
        const { url, size } = await uploadAttachment({
          bytes: audioBytes,
          filename: `respuesta-${Date.now()}.ogg`,
          contentType: "audio/ogg",
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
          to: message.from,
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
            to: message.from,
            type: "audio",
            link: voiceNote.url,
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
