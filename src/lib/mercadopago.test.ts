import { describe, expect, it } from "vitest";
import { parseMpNotification } from "./mercadopago";

describe("parseMpNotification ids", () => {
  it("accepts the ids Mercado Pago sends", () => {
    expect(parseMpNotification({ type: "payment", data: { id: "123456789" } }, new URLSearchParams())).toEqual({ type: "payment", id: "123456789" });
    expect(parseMpNotification({}, new URLSearchParams("topic=preapproval&id=2c93808484a1b2c30184a2b3c4d50001"))).toEqual({ type: "preapproval", id: "2c93808484a1b2c30184a2b3c4d50001" });
  });
  it("refuses ids that could steer the request to another API path", () => {
    for (const id of ["../../users/me", "123?x=1", "1/2", "a b", "x#y", "", "9".repeat(65)]) {
      expect(parseMpNotification({ type: "payment", data: { id } }, new URLSearchParams())).toBeNull();
    }
    expect(parseMpNotification({}, new URLSearchParams("type=payment&data.id=../../x"))).toBeNull();
  });
});
