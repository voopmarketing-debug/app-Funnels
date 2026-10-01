import { describe, expect, it } from "vitest";
import { billingMonthsFromProductName, extendSubscriptionEnd, parseHotmartPurchase, planTierFromProductName } from "./hotmart";

describe("planTierFromProductName", () => {
  it("maps the Pro and Scale products", () => {
    expect(planTierFromProductName("Funnels Labs Pro")).toBe("PRO");
    expect(planTierFromProductName("Agente IA - Plan PRO mensual")).toBe("PRO");
    expect(planTierFromProductName("Funnels Labs Scale")).toBe("SCALE");
  });

  it("leaves everything else on the default plan", () => {
    expect(planTierFromProductName("Funnels Labs Starter")).toBeUndefined();
    expect(planTierFromProductName("Producto de prueba")).toBeUndefined();
    expect(planTierFromProductName("")).toBeUndefined();
  });
});

describe("billingMonthsFromProductName", () => {
  it("is monthly unless the name says otherwise", () => {
    expect(billingMonthsFromProductName("Funnels Labs Starter")).toBe(1);
    expect(billingMonthsFromProductName("Starter trimestral")).toBe(3);
    expect(billingMonthsFromProductName("Plan Pro anual")).toBe(12);
  });
});

describe("extendSubscriptionEnd", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("pays from the charge date, plus grace days", () => {
    expect(extendSubscriptionEnd(null, 1, now).toISOString().slice(0, 10)).toBe("2026-11-04");
    expect(extendSubscriptionEnd(new Date("2026-09-01T00:00:00Z"), 1, now).toISOString().slice(0, 10)).toBe("2026-11-04");
  });
  it("a renewal charged near the end adds the next month", () => {
    const first = extendSubscriptionEnd(null, 1, now); // 2026-11-04
    const renewed = extendSubscriptionEnd(first, 1, new Date("2026-11-01T12:00:00Z"));
    expect(renewed.toISOString().slice(0, 10)).toBe("2026-12-04");
  });
  it("two notices about the same charge don't add two months", () => {
    const once = extendSubscriptionEnd(null, 1, now);
    expect(extendSubscriptionEnd(once, 1, now).toISOString()).toBe(once.toISOString());
  });
});

describe("parseHotmartPurchase", () => {
  const payload = (event: string) => ({
    id: "evt-1",
    event,
    data: {
      buyer: { email: "cliente@ejemplo.com", name: "Clínica Ruiz", checkout_phone: "3001234567" },
      product: { name: "Funnels Labs Starter" },
      purchase: { transaction: "HP123" },
    },
  });
  it("reads approved and refunded purchases", () => {
    expect(parseHotmartPurchase(payload("PURCHASE_APPROVED"))).toMatchObject({ action: "grant", transaction: "HP123", email: "cliente@ejemplo.com" });
    expect(parseHotmartPurchase(payload("PURCHASE_REFUNDED"))).toMatchObject({ action: "revoke", transaction: "HP123" });
  });
  it("ignores events it doesn't act on", () => {
    expect(parseHotmartPurchase(payload("SUBSCRIPTION_CANCELLATION"))).toBeNull();
  });
});
