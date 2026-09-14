import type { PlanTier } from "@prisma/client";

// Mirrors the plan cards on the public landing page (src/app/page.tsx,
// section #precios) — keep both in sync if pricing changes. `null` means
// unlimited. Purely informational for now: nothing here enforces the cap or
// blocks the agent from replying once a business goes over it — see
// PROJECT_STATE.md for why (no billing integration to pair it with yet).
export const PLAN_LIMITS: Record<PlanTier, number | null> = {
  STARTER: 500,
  PRO: 2000,
  SCALE: null,
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  SCALE: "Scale",
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
