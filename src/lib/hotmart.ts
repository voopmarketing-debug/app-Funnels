// Hotmart's webhook (v2) payload shape, as documented — verify against a
// real delivery (Hotmart's webhook settings page has a "Testar" / send-test
// button) before relying on this in production, since payloads have drifted
// across Hotmart API versions before.
import type { PlanTier } from "@prisma/client";

export type HotmartPurchase = {
  event: string;
  email: string;
  name: string;
  phone: string;
  productName: string;
};

// Events that mean "the client should get access now." PURCHASE_COMPLETE
// covers one-off/first-charge approval; PURCHASE_APPROVED is the general
// "payment cleared" event Hotmart sends for both one-time and recurring
// charges.
const GRANT_ACCESS_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);

export function parseHotmartPurchase(payload: unknown): HotmartPurchase | null {
  if (typeof payload !== "object" || payload === null) return null;
  const root = payload as Record<string, unknown>;

  const event = typeof root.event === "string" ? root.event : "";
  if (!GRANT_ACCESS_EVENTS.has(event)) return null;

  const data = root.data as Record<string, unknown> | undefined;
  const buyer = data?.buyer as Record<string, unknown> | undefined;
  const product = data?.product as Record<string, unknown> | undefined;

  const email = typeof buyer?.email === "string" ? buyer.email : "";
  if (!email) return null;

  const name = typeof buyer?.name === "string" ? buyer.name : "";
  const phone =
    (typeof buyer?.checkout_phone === "string" ? buyer.checkout_phone : "") ||
    (typeof buyer?.phone === "string" ? buyer.phone : "");
  const productName = typeof product?.name === "string" ? product.name : "";

  return { event, email, name, phone, productName };
}

/**
 * Which plan a Hotmart product sells, from its name — the Hotmart product
 * for each plan must carry the plan's name ("… Pro", "… Scale"). Anything
 * else (including the Starter product) provisions the default Starter plan;
 * the agency can still change it from Clientes.
 */
export function planTierFromProductName(productName: string): PlanTier | undefined {
  if (/\bscale\b/i.test(productName)) return "SCALE";
  if (/\bpro\b/i.test(productName)) return "PRO";
  return undefined;
}
