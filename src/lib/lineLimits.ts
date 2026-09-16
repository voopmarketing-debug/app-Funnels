import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LINE_LIMITS } from "@/lib/plans";

const TIER_RANK: Record<PlanTier, number> = { STARTER: 0, PRO: 1, SCALE: 2 };

export type AccountLineStatus = {
  count: number;
  limit: number | null;
  planTier: PlanTier;
  atLimit: boolean;
};

/**
 * How many WhatsApp lines (businesses) this account owns, and whether
 * they've hit the cap for their plan. A client's plan lives per-business
 * (the agency assigns it there), so when someone owns more than one we take
 * the most permissive tier among them — in practice they should all match,
 * since it's one subscription, but this keeps the check correct either way.
 */
export async function getAccountLineStatus(userId: string): Promise<AccountLineStatus> {
  const memberships = await prisma.membership.findMany({
    where: { userId, role: "OWNER" },
    select: { business: { select: { planTier: true } } },
  });

  const count = memberships.length;
  const planTier = memberships.reduce<PlanTier>(
    (best, m) => (TIER_RANK[m.business.planTier] > TIER_RANK[best] ? m.business.planTier : best),
    "STARTER",
  );

  const limit = LINE_LIMITS[planTier];
  return { count, limit, planTier, atLimit: limit !== null && count >= limit };
}
