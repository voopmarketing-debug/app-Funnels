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

  const conversation = await prisma.conversation.upsert({
    where: {
      businessId_customerPhone: { businessId: business.id, customerPhone: message.from },
    },
    update: { customerName: message.contactName, lastMessageAt: new Date() },
    create: {
      businessId: business.id,
      customerPhone: message.from,
      customerName: message.contactName,
    },
  });

  const previousMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: message.text,
      whatsappMsgId: message.whatsappMsgId,
    },
  });

  const history: AgentHistoryMessage[] = previousMessages.map((msg) => ({
    role: msg.role === "CUSTOMER" ? "user" : "assistant",
    content: msg.content,
  }));

  let reply: string;
  try {
    reply = await generateAgentReply({
      systemPrompt: business.agent.systemPrompt,
      model: business.agent.model,
      temperature: business.agent.temperature,
      history,
      userMessage: message.text,
    });
  } catch (err) {
    console.error("[ANTHROPIC_CALL_FAILED]", err);
    throw err;
  }

  const accessToken = decryptSecret(business.wabaAccessToken);
  const badCharIndex = [...accessToken].findIndex((ch) => ch.charCodeAt(0) > 255);
  console.log(
    "[WHATSAPP_TOKEN_DIAGNOSTIC]",
    JSON.stringify({
      length: accessToken.length,
      badCharIndex,
      badCharCode: badCharIndex >= 0 ? accessToken.charCodeAt(badCharIndex) : null,
    }),
  );

  let messageId: string;
  try {
    ({ messageId } = await sendWhatsAppTextMessage({
      phoneNumberId: business.wabaPhoneNumberId!,
      accessToken,
      to: message.from,
      text: reply,
    }));
  } catch (err) {
    console.error("[WHATSAPP_SEND_FAILED]", err);
    throw err;
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "AGENT",
      content: reply,
      whatsappMsgId: messageId,
    },
  });
}
