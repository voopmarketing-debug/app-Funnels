import type { PlanTier } from "@prisma/client";
import { billingMonthsFromProductName, planTierFromProductName } from "@/lib/hotmart";
import { PLAN_PRICE_COP } from "@/lib/plans";

/**
 * Which plan a Mercado Pago payment or subscription is for: the plan name in
 * its title ("Funnels Labs Pro") wins; otherwise an exact plan price in COP.
 * Null when it doesn't look like a plan at all.
 */
export function mpPlanFor(title: string, amount: number): { planTier: PlanTier; months: number } | null {
  const months = billingMonthsFromProductName(title);
  const byName = planTierFromProductName(title);
  if (byName) return { planTier: byName, months };
  const byPrice = (Object.entries(PLAN_PRICE_COP) as [PlanTier, number][]).find(([, price]) => price * months === amount || price === amount);
  if (byPrice) return { planTier: byPrice[0], months: byPrice[1] === amount ? 1 : months };
  if (/starter|plan|suscrip|membres|funnels/i.test(title)) return { planTier: "STARTER", months };
  return null;
}
