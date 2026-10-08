import type { PlanTier } from "@prisma/client";

// Mirrors the plan cards on the public landing page (src/app/page.tsx,
// section #precios) — keep both in sync if pricing changes. `null` means
// unlimited. Enforced in lib/agent.ts: once a business is at its limit, a
// genuinely new contact that month no longer triggers an AI reply (paused
// for a human instead) — see the plan-limit check in handleIncomingMessage.
// These numbers are chosen so AI cost (see src/lib/ai.ts's prompt caching)
// stays profitable against each plan's quarterly price even in a worst-case
// usage pattern, not just on average. At the monthly prices on the landing
// page (Starter US$97, Pro US$297), a client that uses its whole quota
// (~US$0.12 of AI per contact) still leaves ~50% after Hotmart's fee.
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
// llave en mano tier). Starter = one business, matching its "una por
// negocio" positioning; Pro = up to 3, for a small multi-location or
// multi-brand client. PLAN_LIMITS above is pooled per account (not per
// line — see getAccountActiveContactsThisMonth), so more lines no longer
// multiplies AI cost exposure the way it did before that fix.
export const LINE_LIMITS: Record<PlanTier, number | null> = {
  STARTER: 1,
  PRO: 3,
  SCALE: null,
};

// How many invited teammates (MEMBER role — see inviteTeamMember in
// actions.ts) a business can have at once, on top of its owner. Starter is
// capped at 3 so a small team (e.g. 3 salespeople sharing one WhatsApp
// line, each on their own embudo) fits without needing Pro. `null` means
// no cap.
export const TEAM_MEMBER_LIMITS: Record<PlanTier, number | null> = {
  STARTER: 3,
  PRO: 10,
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

// Monthly list price per plan in USD — mirrors the landing page (src/app/
// page.tsx, #precios). Used by the agency's Rentabilidad page as each
// account's revenue unless the account has its own User.monthlyPriceUsd.
export const PLAN_PRICE_USD: Record<PlanTier, number> = {
  STARTER: 97,
  PRO: 297,
  SCALE: 597,
};

// The same prices in COP, as charged through Mercado Pago (~4.000 COP per
// USD, rounded). A Mercado Pago payment or subscription of exactly one of
// these amounts is recognized as that plan when its title doesn't say.
export const PLAN_PRICE_COP: Record<PlanTier, number> = {
  STARTER: 390000,
  PRO: 1190000,
  SCALE: 2390000,
};

// Which models the agency can pick for a client's WhatsApp replies (see
// setAgentModel in lib/actions.ts). Haiku answers at roughly half the cost
// per message; Sonnet is the default and the better closer.
export const AGENT_MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 · calidad máxima" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 · económico" },
] as const;

// Free days a self-registered account gets after registering its card in
// Mercado Pago (see app/activar). The first charge happens when it ends.
export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS) || 7;
