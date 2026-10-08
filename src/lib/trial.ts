import { prisma } from "@/lib/prisma";
import { createMpTrialPlan, fetchMpPreapproval, isMpPlanActive, type MpPreapproval } from "@/lib/mercadopago";
import { applySubscriptionCharge } from "@/lib/payments";
import { mpPlanFor } from "@/lib/mercadopagoPlans";
import { PLAN_LABELS, PLAN_PRICE_COP, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/plans";

// How long after someone leaves /activar for Mercado Pago a subscription with
// an unknown email can still be matched to them.
const CHECKOUT_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

function trialPlanKey(): string {
  return `mp_trial_plan:${TRIAL_PLAN}:${PLAN_PRICE_COP[TRIAL_PLAN]}:${TRIAL_DAYS}`;
}

export function appHost(): string {
  return process.env.APP_HOST ?? "agente.funnelslabs.app";
}

/** The id of the trial plan the app created in Mercado Pago, if any. */
export async function savedTrialPlanId(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: trialPlanKey() } });
  if (!row) return null;
  try {
    return (JSON.parse(row.value) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

/**
 * The Mercado Pago checkout link of the free-trial plan. Created on first use
 * and reused; a new one is made whenever the price or trial length changes
 * (they're part of the key) or the saved one was deactivated in Mercado Pago.
 */
export async function trialPlanCheckout(): Promise<{ initPoint: string } | { error: string }> {
  const key = trialPlanKey();
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) {
    try {
      const saved = JSON.parse(row.value) as { id: string; initPoint: string };
      if (await isMpPlanActive(saved.id)) return { initPoint: saved.initPoint };
    } catch {
      // Unreadable value: make a new plan below.
    }
  }
  const created = await createMpTrialPlan({
    reason: `Funnels Labs ${PLAN_LABELS[TRIAL_PLAN]}`,
    amountCop: PLAN_PRICE_COP[TRIAL_PLAN],
    trialDays: TRIAL_DAYS,
    backUrl: `https://${appHost()}/activar?estado=listo`,
  });
  if ("error" in created) return created;
  const value = JSON.stringify({ id: created.id, initPoint: created.initPoint });
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return { initPoint: created.initPoint };
}

type Account = { id: string; email: string; mpPreapprovalId: string | null };

/**
 * Which account a Mercado Pago subscription pays for, most certain first:
 * our own id in external_reference, a subscription already linked to an
 * account, the payer's email when it's an account still waiting on its card,
 * the one person who left /activar for Mercado Pago shortly before it was
 * created, and finally any account with the payer's email.
 */
export async function accountForPreapproval(sub: MpPreapproval): Promise<Account | null> {
  const select = { id: true, email: true, mpPreapprovalId: true } as const;
  if (sub.externalReference?.startsWith("user:")) {
    const byRef = await prisma.user.findUnique({ where: { id: sub.externalReference.slice(5) }, select });
    if (byRef) return byRef;
  }
  const linked = await prisma.user.findUnique({ where: { mpPreapprovalId: sub.id }, select });
  if (linked) return linked;
  const byEmail = sub.email
    ? await prisma.user.findUnique({ where: { email: sub.email.trim().toLowerCase() }, select: { ...select, activationRequired: true } })
    : null;
  if (byEmail?.activationRequired) return byEmail;
  const candidates = await prisma.user.findMany({
    where: {
      activationRequired: true,
      mpPreapprovalId: null,
      trialCheckoutAt: { gte: new Date(sub.createdAt.getTime() - CHECKOUT_MATCH_WINDOW_MS), lte: new Date(sub.createdAt.getTime() + 60_000) },
    },
    select,
    take: 2,
  });
  // Two people checking out at once: don't guess, the return page (which
  // knows who is signed in) or the agency settles it.
  if (candidates.length === 1) return candidates[0];
  // Otherwise an existing account paying with its own email (or a purchase
  // from the sales page, which creates the account).
  return byEmail;
}

/** Free days a subscription comes with: its own free_trial, or our trial plan's. */
export async function trialDaysFor(sub: MpPreapproval): Promise<number> {
  if (sub.trialDays) return sub.trialDays;
  if (sub.planId && sub.planId === (await savedTrialPlanId())) return TRIAL_DAYS;
  return 0;
}

/** Activates an account from an authorized subscription, once (idempotent per subscription). */
export async function activateFromPreapproval(sub: MpPreapproval, account: Account): Promise<void> {
  if (!account.mpPreapprovalId) {
    await prisma.user.update({ where: { id: account.id }, data: { mpPreapprovalId: sub.id } }).catch((err) => {
      // Unique clash: the subscription is already linked to someone else.
      console.error("Could not link Mercado Pago subscription", sub.id, "to account", account.id, err);
    });
  }
  const trialDays = await trialDaysFor(sub);
  await applySubscriptionCharge({
    provider: "mercadopago",
    transaction: `preapproval:${sub.id}`,
    action: "grant",
    event: "preapproval.authorized",
    email: account.email,
    name: "",
    phone: "",
    productName: sub.reason,
    planTier: mpPlanFor(sub.reason, sub.amount)?.planTier ?? TRIAL_PLAN,
    chargeDate: sub.createdAt,
    trialDays: trialDays || undefined,
  });
}

/**
 * Back on /activar from Mercado Pago, which appends the subscription id: the
 * signed-in person is who just registered the card, so link it to them
 * without waiting for (or depending on) the webhook.
 */
export async function claimReturnedPreapproval(userId: string, preapprovalId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, mpPreapprovalId: true, activationRequired: true } });
  if (!user?.activationRequired) return false;
  const sub = await fetchMpPreapproval(preapprovalId);
  if (!sub?.approved) return false;
  const owner = await prisma.user.findUnique({ where: { mpPreapprovalId: sub.id }, select: { id: true } });
  if (owner && owner.id !== user.id) return false;
  const ref = sub.externalReference?.startsWith("user:") ? sub.externalReference.slice(5) : null;
  if (ref && ref !== user.id) return false;
  await activateFromPreapproval(sub, user);
  const after = await prisma.user.findUnique({ where: { id: userId }, select: { activationRequired: true } });
  return !after?.activationRequired;
}
