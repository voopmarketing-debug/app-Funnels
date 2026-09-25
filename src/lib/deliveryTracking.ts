import { prisma } from "@/lib/prisma";
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
    select: { id: true, deliveryStatus: true },
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
      deliveryError: update.status === "failed" ? (update.errorMessage ?? null) : null,
    },
  });
}
