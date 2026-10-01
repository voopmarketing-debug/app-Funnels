import { describe, expect, it } from "vitest";
import { mpPlanFor } from "./mercadopagoPlans";

describe("mpPlanFor", () => {
  it("reads the plan from the title", () => {
    expect(mpPlanFor("Funnels Labs Pro", 999)).toEqual({ planTier: "PRO", months: 1 });
    expect(mpPlanFor("Plan Starter mensual", 0)).toEqual({ planTier: "STARTER", months: 1 });
  });
  it("falls back to the exact plan price", () => {
    expect(mpPlanFor("", 390000)).toEqual({ planTier: "STARTER", months: 1 });
    expect(mpPlanFor("Pago", 1190000)).toEqual({ planTier: "PRO", months: 1 });
  });
  it("ignores payments that aren't a plan", () => {
    expect(mpPlanFor("Asesoría", 50000)).toBeNull();
  });
});
