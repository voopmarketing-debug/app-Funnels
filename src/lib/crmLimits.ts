import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BROADCAST_LIMITS, CONTACT_LIMITS, planUsageStatus, type PlanUsageStatus } from "@/lib/plans";

export type Usage = { used: number; limit: number | null; status: PlanUsageStatus };

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function planOf(businessId: string): Promise<PlanTier> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { planTier: true } });
  return b?.planTier ?? "STARTER";
}

/** CRM contacts saved on this line against its plan's fair-use cap. */
export async function getContactUsage(businessId: string): Promise<Usage> {
  const [planTier, used] = await Promise.all([planOf(businessId), prisma.conversation.count({ where: { businessId } })]);
  const limit = CONTACT_LIMITS[planTier];
  return { used, limit, status: planUsageStatus(used, limit) };
}

/** Mass-message recipients this calendar month against the plan's monthly cap. */
export async function getBroadcastUsage(businessId: string): Promise<Usage> {
  const [planTier, agg] = await Promise.all([
    planOf(businessId),
    prisma.broadcast.aggregate({ where: { businessId, createdAt: { gte: startOfMonth() } }, _sum: { sentCount: true } }),
  ]);
  // Only messages that actually went out count; ones WhatsApp rejected are free.
  const used = agg._sum.sentCount ?? 0;
  const limit = BROADCAST_LIMITS[planTier];
  return { used, limit, status: planUsageStatus(used, limit) };
}

export function remaining(usage: Usage): number {
  return usage.limit === null ? Number.POSITIVE_INFINITY : Math.max(0, usage.limit - usage.used);
}
