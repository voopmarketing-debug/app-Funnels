import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMpCheckoutLink, createMpTrialPlan, fetchMpPayment, fetchMpPreapproval, isMpPlanActive, type MpPayment } from "@/lib/mercadopago";
import { applySubscriptionCharge } from "@/lib/payments";
import { PLAN_LABELS, monthlyPriceCop } from "@/lib/plans";
import { activateFromPreapproval, appHost } from "@/lib/trial";
import { isSubscriptionActive } from "@/lib/subscription";

// Renewing an account whose plan ran out (or never had a card): either a
// monthly subscription that renews itself, or one month paid once.

const TIER_ORDER: PlanTier[] = ["STARTER", "PRO", "SCALE"];
const DAY_MS = 86_400_000;
export const NOTICE_DAYS = 5;
const RENEWAL_PLAN_PREFIX = "mp_renewal_plan:";

export type RenewalContext = {
  userId: string;
  email: string;
  planTier: PlanTier;
  priceCop: number;
  // Whether any line the account owns is still inside its paid period.
  active: boolean;
  // When the paid period ends (the latest of its lines); null when never dated.
  endsAt: Date | null;
  // Over, or ending within NOTICE_DAYS: time to ask for the renewal.
  ending: boolean;
};

/** What this signed-in account would pay to renew; null when it owns no business. */
export async function renewalContext(userId: string): Promise<RenewalContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      monthlyPriceUsd: true,
      memberships: { where: { role: "OWNER" }, select: { business: { select: { planTier: true, subscriptionEndsAt: true } } } },
    },
  });
  if (!user || user.memberships.length === 0) return null;
  // One subscription covers every line the account owns: the highest plan among them.
  const planTier = user.memberships.map((m) => m.business.planTier).sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0];
  const active = user.memberships.some((m) => isSubscriptionActive(m.business.subscriptionEndsAt));
  const endsAt = user.memberships.reduce<Date | null>((max, m) => {
    const end = m.business.subscriptionEndsAt;
    return end && (!max || end > max) ? end : max;
  }, null);
  return {
    userId,
    email: user.email,
    planTier,
    priceCop: monthlyPriceCop(planTier, user.monthlyPriceUsd),
    active,
    endsAt,
    ending: !active || (!!endsAt && endsAt.getTime() - Date.now() <= NOTICE_DAYS * DAY_MS),
  };
}

/**
 * The "your plan is about to end" notice at the top of the panel. Only for
 * accounts nobody renews for them: not those with a Mercado Pago card
 * subscription or a Hotmart one, which charge by themselves.
 */
export async function renewalNotice(userId: string, now = new Date()): Promise<{ daysLeft: number; expired: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      mpPreapprovalId: true,
      activationRequired: true,
      memberships: { where: { role: "OWNER" }, select: { business: { select: { subscriptionEndsAt: true } } } },
    },
  });
  if (!user || user.mpPreapprovalId || user.activationRequired) return null;
  const ends = user.memberships.map((m) => m.business.subscriptionEndsAt).filter((d): d is Date => !!d);
  if (ends.length === 0) return null;
  const end = new Date(Math.max(...ends.map((d) => d.getTime())));
  const ms = end.getTime() - now.getTime();
  if (ms > NOTICE_DAYS * DAY_MS) return null;
  const latest = await prisma.paymentEvent.findFirst({
    where: { email: user.email.toLowerCase(), action: "grant" },
    orderBy: { createdAt: "desc" },
    select: { provider: true },
  });
  if (latest?.provider === "hotmart") return null;
  return { daysLeft: Math.max(0, Math.ceil(ms / DAY_MS)), expired: ms <= 0 };
}

export function renewalTitle(planTier: PlanTier): string {
  return `Funnels Labs ${PLAN_LABELS[planTier]}`;
}

function backUrl(): string {
  return `https://${appHost()}/renovar?estado=listo`;
}

/**
 * The Mercado Pago link to start a self-renewing monthly subscription for a
 * plan and price. Made once per (plan, price) and reused; anyone opening it
 * pays with their own Mercado Pago account, whatever its email.
 */
export async function renewalPlanCheckout(planTier: PlanTier, amountCop: number): Promise<{ initPoint: string } | { error: string }> {
  const key = `${RENEWAL_PLAN_PREFIX}${planTier}:${amountCop}`;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) {
    try {
      const saved = JSON.parse(row.value) as { id: string; initPoint: string };
      if (await isMpPlanActive(saved.id)) return { initPoint: saved.initPoint };
    } catch {
      // Unreadable value: make a new plan below.
    }
  }
  const created = await createMpTrialPlan({ reason: renewalTitle(planTier), amountCop, trialDays: 0, backUrl: backUrl() });
  if ("error" in created) return created;
  const value = JSON.stringify({ id: created.id, initPoint: created.initPoint });
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return { initPoint: created.initPoint };
}

/** Whether a Mercado Pago subscription plan is one of the renewal plans made above. */
export async function isRenewalPlan(planId: string | null): Promise<boolean> {
  if (!planId) return false;
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: RENEWAL_PLAN_PREFIX } }, select: { value: true } });
  return rows.some((r) => {
    try {
      return (JSON.parse(r.value) as { id?: string }).id === planId;
    } catch {
      return false;
    }
  });
}

/** One month paid once (card, PSE, Nequi…). Our id rides along so the payment finds the account whoever pays. */
export async function oneMonthCheckout(ctx: RenewalContext): Promise<string | null> {
  return createMpCheckoutLink({
    title: `${renewalTitle(ctx.planTier)} (1 mes)`,
    priceCop: ctx.priceCop,
    externalReference: `renewal:${ctx.userId}`,
    backUrl: backUrl(),
  });
}

/**
 * Applies an approved one-month renewal payment to the account named in its
 * reference, exactly once per payment (the webhook and the return page can
 * both get here).
 */
export async function applyOneMonthPayment(payment: MpPayment): Promise<"applied" | "duplicate" | "ignored"> {
  if (!payment.approved || payment.currency !== "COP" || payment.amount <= 0) return "ignored";
  if (!payment.externalReference?.startsWith("renewal:")) return "ignored";
  const ctx = await renewalContext(payment.externalReference.slice("renewal:".length));
  if (!ctx) return "ignored";
  const result = await applySubscriptionCharge({
    provider: "mercadopago",
    transaction: `payment:${payment.id}`,
    action: "grant",
    event: "payment.approved",
    email: ctx.email,
    name: "",
    phone: "",
    productName: `${renewalTitle(ctx.planTier)} (1 mes)`,
    planTier: ctx.planTier,
    chargeDate: payment.approvedAt ?? new Date(),
  });
  return result.status === "activated" ? "applied" : result.status === "duplicate" ? "duplicate" : "ignored";
}

/** Back from Mercado Pago after paying one month: verify the payment and apply it. */
export async function claimReturnedPayment(userId: string, paymentId: string): Promise<boolean> {
  const payment = await fetchMpPayment(paymentId);
  if (!payment || payment.externalReference !== `renewal:${userId}`) return false;
  return (await applyOneMonthPayment(payment)) !== "ignored";
}

/**
 * Back from Mercado Pago after starting the monthly subscription: it carries
 * the subscription id, and whoever is signed in is who just paid, so it is
 * linked to them without waiting for the webhook. Only subscriptions started
 * from our own renewal plans can be claimed this way.
 */
export async function claimReturnedRenewal(userId: string, preapprovalId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, mpPreapprovalId: true } });
  if (!user) return false;
  const sub = await fetchMpPreapproval(preapprovalId);
  if (!sub?.approved || !(await isRenewalPlan(sub.planId))) return false;
  const owner = await prisma.user.findUnique({ where: { mpPreapprovalId: sub.id }, select: { id: true } });
  if (owner && owner.id !== user.id) return false;
  await activateFromPreapproval(sub, user, { replaceOld: true });
  return true;
}
