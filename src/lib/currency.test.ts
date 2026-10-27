import { describe, expect, it } from "vitest";
import { asCurrency, formatMoney, isCurrency } from "./currency";

describe("currency", () => {
  it("formats each currency with its own symbol and thousands", () => {
    expect(formatMoney(89000, "COP")).toBe("$89.000");
    expect(formatMoney(1200, "USD")).toBe("US$1,200");
    expect(formatMoney(1200, "EUR")).toBe("€1.200");
    expect(formatMoney(97, "EUR")).toBe("€97");
  });
  it("falls back to pesos for an unknown code", () => {
    expect(formatMoney(5000, "XYZ")).toBe("$5.000");
    expect(asCurrency("usd")).toBe("COP");
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("GBP")).toBe(false);
  });
});
