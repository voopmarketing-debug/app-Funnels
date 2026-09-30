import { prisma } from "@/lib/prisma";
import { contactLabel } from "@/lib/contactDisplay";
import type { WhatsAppStatusUpdate } from "@/lib/whatsapp";

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/**
 * Applies one WhatsApp delivery-status webhook update to the Message row it
 * refers to (matched by whatsappMsgId) — covers every outbound message
 * (AI/human replies and broadcasts alike), since all of them are created
 * with a whatsappMsgId. Meta can redeliver or reorder these webhooks, so a
 * late "sent" arriving after an already-recorded "read" must not regress
 * the status - only forward sent -> delivered -> read progressions apply.
 * "failed" is a real, common sequel to "sent" (accepted, then genuinely
 * failed to reach the device - invalid number, WhatsApp uninstalled, etc.),
 * so it applies as long as the message hasn't already been confirmed
 * delivered or read - at that point a stray "failed" makes no sense and is
 * ignored instead of downgrading a status we know is more advanced.
 */
export async function applyDeliveryStatus(update: WhatsAppStatusUpdate): Promise<void> {
  const message = await prisma.message.findFirst({
    where: { whatsappMsgId: update.whatsappMsgId },
    select: {
      id: true,
      deliveryStatus: true,
      broadcastId: true,
      conversation: { select: { id: true, businessId: true, customerName: true, customerPhone: true } },
    },
  });
  // No matching message — e.g. a status echo for a send we don't track, or
  // it arrived before our own message.create() committed. Nothing to update.
  if (!message) return;

  const currentRank = message.deliveryStatus ? (STATUS_RANK[message.deliveryStatus] ?? 0) : 0;
  const incomingRank = STATUS_RANK[update.status] ?? 0;
  const shouldApply = update.status === "failed" ? currentRank < STATUS_RANK.delivered : incomingRank > currentRank;
  if (!shouldApply) return;

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deliveryStatus: update.status,
      deliveryStatusAt: new Date(update.timestamp * 1000),
      // The Meta code rides along in parentheses — lib/replyRecovery.ts reads
      // it to tell a retryable failure from a permanent one.
      deliveryError:
        update.status === "failed"
          ? `${update.errorMessage ?? "Error de entrega"}${update.errorCode ? ` (${update.errorCode})` : ""}`
          : null,
    },
  });

  // A reply (AI or human) that never reached the customer is exactly the
  // "they wrote and got nothing" case — tell the business right away. A
  // retryable failure is also re-sent automatically (lib/replyRecovery.ts).
  // Broadcast failures are already summarized in the Difusiones tab.
  if (update.status === "failed" && !message.broadcastId) {
    const who = contactLabel(message.conversation.customerName, message.conversation.customerPhone);
    await prisma.notification.create({
      data: {
        businessId: message.conversation.businessId,
        conversationId: message.conversation.id,
        type: "WHATSAPP_ALERT",
        message: `⚠ WhatsApp no entregó la respuesta a ${who}: ${update.errorMessage ?? "error de entrega"}${update.errorCode ? ` (código ${update.errorCode})` : ""}. Se reintentará automáticamente si es posible.`,
      },
    });
  }
}
