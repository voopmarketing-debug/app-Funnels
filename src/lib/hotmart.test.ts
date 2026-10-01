import { describe, expect, it } from "vitest";
import { planTierFromProductName } from "./hotmart";

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
