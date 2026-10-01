import type { PlanTier } from "@prisma/client";

// Hotmart's webhook (v2) payload shape, as documented — verify against a
// real delivery (Hotmart's webhook settings page has a "Testar" / send-test
// button) before relying on this in production, since payloads have drifted
// across Hotmart API versions before.
export type HotmartPurchase = {
  event: string;
  email: string;
  name: string;
  phone: string;
  productName: string;
  // Hotmart's transaction code (e.g. "HP16015479281022"), one per charge —
  // each monthly renewal is its own transaction. Used to apply a payment
  // only once (see PaymentEvent).
  transaction: string;
};

// Events that mean "the client should get access now." PURCHASE_COMPLETE
// covers one-off/first-charge approval; PURCHASE_APPROVED is the general
// "payment cleared" event Hotmart sends for both one-time and recurring
// charges.
const GRANT_ACCESS_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
// Money went back to the buyer: access for that charge ends now.
const REVOKE_ACCESS_EVENTS = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK"]);

export type HotmartAction = "grant" | "revoke";

export function hotmartAction(event: string): HotmartAction | null {
  if (GRANT_ACCESS_EVENTS.has(event)) return "grant";
  if (REVOKE_ACCESS_EVENTS.has(event)) return "revoke";
  return null;
}

/** The buyer/product/charge in a Hotmart webhook, or null when it isn't one we act on. */
export function parseHotmartPurchase(payload: unknown): (HotmartPurchase & { action: HotmartAction }) | null {
  if (typeof payload !== "object" || payload === null) return null;
  const root = payload as Record<string, unknown>;

  const event = typeof root.event === "string" ? root.event : "";
  const action = hotmartAction(event);
  if (!action) return null;

  const data = root.data as Record<string, unknown> | undefined;
  const buyer = data?.buyer as Record<string, unknown> | undefined;
  const product = data?.product as Record<string, unknown> | undefined;
  const purchase = data?.purchase as Record<string, unknown> | undefined;

  const email = typeof buyer?.email === "string" ? buyer.email : "";
  if (!email) return null;

  const name = typeof buyer?.name === "string" ? buyer.name : "";
  const phone =
    (typeof buyer?.checkout_phone === "string" ? buyer.checkout_phone : "") ||
    (typeof buyer?.phone === "string" ? buyer.phone : "");
  const productName = typeof product?.name === "string" ? product.name : "";
  // Fallback when a payload has no transaction code: the delivery id, so a
  // retried delivery still isn't applied twice.
  const transaction =
    (typeof purchase?.transaction === "string" && purchase.transaction) ||
    (typeof root.id === "string" && root.id) ||
    `${email}:${typeof root.creation_date === "number" ? root.creation_date : ""}`;

  return { event, action, email, name, phone, productName, transaction };
}

/**
 * Which plan a Hotmart product sells, from its name — the Hotmart product
 * for each plan must carry the plan's name ("… Pro", "… Scale"). Anything
 * else (including the Starter product) provisions the default Starter plan;
 * the agency can still change it from Clientes.
 */
export function planTierFromProductName(productName: string): PlanTier | undefined {
  if (/\bscale\b|consultor/i.test(productName)) return "SCALE";
  if (/\bpro\b/i.test(productName)) return "PRO";
  return undefined;
}

/** Months of access one charge of this product buys (monthly unless the name says otherwise). */
export function billingMonthsFromProductName(productName: string): number {
  if (/anual|annual|12 ?meses/i.test(productName)) return 12;
  if (/semestr|6 ?meses/i.test(productName)) return 6;
  if (/trimestr|3 ?meses/i.test(productName)) return 3;
  return 1;
}

// Hotmart retries a failed renewal charge for a few days; don't lock a
// paying client out in the meantime.
export const RENEWAL_GRACE_DAYS = 3;

/** New end of the paid period after a charge: from today, or from the current end if it hasn't passed yet. */
export function extendSubscriptionEnd(currentEnd: Date | null, months: number, now = new Date()): Date {
  const base = currentEnd && currentEnd > now ? new Date(currentEnd) : new Date(now);
  // Grace days only count once: strip them from a still-running period
  // before adding the next one.
  if (currentEnd && currentEnd > now) base.setUTCDate(base.getUTCDate() - RENEWAL_GRACE_DAYS);
  const end = new Date(base);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCDate(end.getUTCDate() + RENEWAL_GRACE_DAYS);
  return end;
}
