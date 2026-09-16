import type { PlanTier } from "@prisma/client";

// Mirrors the plan cards on the public landing page (src/app/page.tsx,
// section #precios) — keep both in sync if pricing changes. `null` means
// unlimited. Enforced in lib/agent.ts: once a business is at its limit, a
// genuinely new contact that month no longer triggers an AI reply (paused
// for a human instead) — see the plan-limit check in handleIncomingMessage.
// These numbers are chosen so AI cost (see src/lib/ai.ts's prompt caching)
// stays profitable against each plan's quarterly price even in a worst-case
// usage pattern, not just on average — PRO's 1,200 leaves ~14% margin on
// Anthropic cost alone even in that worst case; STARTER's 400 leaves ~43%.
export const PLAN_LIMITS: Record<PlanTier, number | null> = {
  STARTER: 400,
  PRO: 1200,
  SCALE: null,
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  SCALE: "Scale",
};

// How many separate WhatsApp lines (each its own Business record, with its
// own agent) an account can run under each plan — this one IS enforced (see
// getAccountLineStatus in lib/lineLimits.ts + createBusiness in actions.ts),
// unlike PLAN_LIMITS above: it's fully under our control, no billing
// integration needed to gate it. `null` means no cap (the "Consultoría" /
// llave en mano tier).
export const LINE_LIMITS: Record<PlanTier, number | null> = {
  STARTER: 3,
  PRO: 6,
  SCALE: null,
};

export const PLAN_TIERS: PlanTier[] = ["STARTER", "PRO", "SCALE"];

export type PlanUsageStatus = "good" | "warning" | "critical" | "unlimited";

export function planUsageStatus(used: number, limit: number | null): PlanUsageStatus {
  if (limit === null) return "unlimited";
  const ratio = used / limit;
  if (ratio >= 1) return "critical";
  if (ratio >= 0.8) return "warning";
  return "good";
}
