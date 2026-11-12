import { describe, expect, it } from "vitest";
import { PLAN_PRICE_COP, PLAN_PRICE_USD, monthlyPriceCop } from "./plans";

describe("monthlyPriceCop", () => {
  it("uses the list price when the account has no price of its own", () => {
    expect(monthlyPriceCop("STARTER", null)).toBe(390_000);
    expect(monthlyPriceCop("PRO", null)).toBe(1_190_000);
    expect(monthlyPriceCop("SCALE", null)).toBe(2_390_000);
  });

  it("converts the agreed dollar price the same way the list prices were made", () => {
    // The list prices in COP are the USD ones at 4.000 pesos, rounded to 10.000.
    for (const tier of ["STARTER", "PRO", "SCALE"] as const) {
      expect(monthlyPriceCop(tier, PLAN_PRICE_USD[tier])).toBe(PLAN_PRICE_COP[tier]);
    }
  });

  it("charges the agreed price of a negotiated account, not the plan's", () => {
    expect(monthlyPriceCop("PRO", 50)).toBe(200_000);
    expect(monthlyPriceCop("STARTER", 0.5)).toBe(10_000);
  });

  it("ignores a price that makes no sense", () => {
    expect(monthlyPriceCop("PRO", 0)).toBe(PLAN_PRICE_COP.PRO);
    expect(monthlyPriceCop("PRO", -5)).toBe(PLAN_PRICE_COP.PRO);
    expect(monthlyPriceCop("PRO", Number.NaN)).toBe(PLAN_PRICE_COP.PRO);
  });
});
