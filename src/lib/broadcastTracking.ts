import { prisma } from "@/lib/prisma";

/**
 * The per-recipient link embedded in a broadcast's outbound message text
 * when Broadcast.ctaUrl is set (see sendBroadcast in lib/actions.ts) —
 * routes through our own domain first so a click can be attributed to the
 * exact conversation that made it (see registerBroadcastClick) before
 * redirecting on to the real destination.
 */
export function buildTrackedLink(broadcastId: string, conversationId: string): string {
  const appHost = process.env.APP_HOST ?? "agente.funnelslabs.app";
  return `https://${appHost}/d/${broadcastId}/${conversationId}`;
}

/**
 * Logs a click on a broadcast's tracked link and returns the real URL to
 * redirect to — called from app/d/[broadcastId]/[conversationId]/route.ts.
 * Returns null only when the broadcast (or its ctaUrl) no longer exists, so
 * the route can 404 instead of redirecting nowhere.
 */
export async function registerBroadcastClick(broadcastId: string, conversationId: string): Promise<string | null> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: { ctaUrl: true, businessId: true },
  });
  if (!broadcast?.ctaUrl) return null;

  // Cross-checked against the broadcast's own business so a malformed or
  // guessed conversationId can't attribute a click to the wrong business's
  // contact — the redirect itself still succeeds either way, only the
  // attribution is skipped.
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId: broadcast.businessId },
    select: { id: true },
  });
  if (!conversation) return broadcast.ctaUrl;

  try {
    await prisma.$transaction([
      prisma.broadcastClick.upsert({
        where: { broadcastId_conversationId: { broadcastId, conversationId } },
        update: {},
        create: { broadcastId, conversationId },
      }),
      prisma.broadcast.update({ where: { id: broadcastId }, data: { clickCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    // Best-effort — a logging failure should never block the redirect the
    // visitor is actually waiting on.
    console.error("Failed to log broadcast click:", err);
  }

  return broadcast.ctaUrl;
}
