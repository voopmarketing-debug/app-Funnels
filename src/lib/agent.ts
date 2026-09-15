import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { sendWhatsAppTextMessage, type WhatsAppInboundMessage } from "@/lib/whatsapp";
import { generateAgentReply, type AgentHistoryMessage } from "@/lib/ai";

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

  // Only needed for a brand-new conversation — every business is seeded
  // with its own pipeline on creation, so this should always find one.
  const firstStage = await prisma.pipelineStage.findFirst({
    where: { businessId: business.id },
    orderBy: { position: "asc" },
  });
  if (!firstStage) {
    console.warn(`Business ${business.id} has no pipeline stages configured`);
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

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: message.text,
      whatsappMsgId: message.whatsappMsgId,
    },
  });

  if (conversation.aiPaused) {
    // A human already took over this specific conversation — the message is
    // saved above so it shows up in the dashboard, but the AI stays quiet
    // instead of talking over them.
    return;
  }

  const history: AgentHistoryMessage[] = previousMessages.map((msg) => ({
    role: msg.role === "CUSTOMER" ? "user" : "assistant",
    content: msg.content,
  }));

  let reply: string;
  try {
    reply = await generateAgentReply({
      systemPrompt: business.agent.systemPrompt,
      tone: business.agent.tone,
      replyLength: business.agent.replyLength,
      industry: business.industry,
      model: business.agent.model,
      history,
      userMessage: message.text,
      owner: ownerMembership?.user,
    });
  } catch (err) {
    // Surface the failure straight into the conversation thread in the
    // dashboard — a plain, ASCII-only summary, since the raw error object
    // has repeatedly broken the platform's own log viewer before we could
    // read it there. Tagged so we know it happened during the Claude call.
    await logInternalError(conversation.id, "IA", err);
    throw err;
  }

  try {
    const { messageId } = await sendWhatsAppTextMessage({
      phoneNumberId: business.wabaPhoneNumberId!,
      accessToken: decryptSecret(business.wabaAccessToken),
      to: message.from,
      text: reply,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "AGENT",
        content: reply,
        whatsappMsgId: messageId,
      },
    });
  } catch (err) {
    // Tagged so we know it happened during the WhatsApp send, not the
    // Claude call above.
    await logInternalError(conversation.id, "WHATSAPP", err);
    throw err;
  }
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
