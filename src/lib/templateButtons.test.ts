import { describe, expect, it } from "vitest";
import { metaButton, normalizeButtons, normalizePhone, readStoredButtons } from "./templateButtons";

describe("normalizeButtons", () => {
  it("accepts a mix and puts the quick replies first", () => {
    const res = normalizeButtons([
      { type: "URL", text: "Ver oferta", url: "https://ejemplo.com/oferta" },
      { type: "QUICK_REPLY", text: "Sí, me interesa" },
      { type: "PHONE_NUMBER", text: "Llamar", phone: "+57 300 123-4567" },
    ]);
    expect(res).toEqual({
      ok: true,
      buttons: [
        { type: "QUICK_REPLY", text: "Sí, me interesa" },
        { type: "URL", text: "Ver oferta", url: "https://ejemplo.com/oferta" },
        { type: "PHONE_NUMBER", text: "Llamar", phone: "+573001234567" },
      ],
    });
  });
  it("asks for what is missing, in words the person can act on", () => {
    expect(normalizeButtons([{ type: "QUICK_REPLY", text: " " }])).toMatchObject({ ok: false, error: expect.stringMatching(/falta el texto/) });
    expect(normalizeButtons([{ type: "URL", text: "Ver", url: "" }])).toMatchObject({ ok: false, error: expect.stringMatching(/falta el enlace/) });
    expect(normalizeButtons([{ type: "URL", text: "Ver", url: "ejemplo.com" }])).toMatchObject({ ok: false, error: expect.stringMatching(/https/) });
    expect(normalizeButtons([{ type: "PHONE_NUMBER", text: "Llamar", phone: "3001234567" }])).toMatchObject({ ok: false, error: expect.stringMatching(/código de país/) });
  });
  it("enforces the limits", () => {
    expect(normalizeButtons([{ type: "QUICK_REPLY", text: "x".repeat(26) }])).toMatchObject({ ok: false });
    expect(normalizeButtons(["a", "b", "c", "d"].map((t) => ({ type: "QUICK_REPLY", text: t })))).toMatchObject({ ok: false, error: expect.stringMatching(/hasta 3/) });
    expect(normalizeButtons([{ type: "QUICK_REPLY", text: "Sí" }, { type: "QUICK_REPLY", text: "sí" }])).toMatchObject({ ok: false, error: expect.stringMatching(/distinto/) });
    expect(
      normalizeButtons([
        { type: "PHONE_NUMBER", text: "A", phone: "+573001234567" },
        { type: "PHONE_NUMBER", text: "B", phone: "+573001234568" },
      ]),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/1 botón de llamada/) });
  });
  it("accepts no buttons", () => {
    expect(normalizeButtons([])).toEqual({ ok: true, buttons: [] });
  });
});

describe("helpers", () => {
  it("normalizes phones", () => {
    expect(normalizePhone("+57 (300) 123-4567")).toBe("+573001234567");
    expect(normalizePhone("300 123 4567")).toBeNull();
  });
  it("builds Meta's shape for each kind", () => {
    expect(metaButton({ type: "QUICK_REPLY", text: "Sí" })).toEqual({ type: "QUICK_REPLY", text: "Sí" });
    expect(metaButton({ type: "URL", text: "Ver", url: "https://a.co/x" })).toEqual({ type: "URL", text: "Ver", url: "https://a.co/x" });
    expect(metaButton({ type: "PHONE_NUMBER", text: "Llamar", phone: "+573001234567" })).toEqual({ type: "PHONE_NUMBER", text: "Llamar", phone_number: "+573001234567" });
  });
  it("reads buttons saved before the other kinds existed", () => {
    expect(readStoredButtons([{ type: "URL", text: "Ver", url: "https://a.co" }, { type: "QUICK_REPLY", text: "Sí" }, { bad: true }])).toEqual([
      { type: "URL", text: "Ver", url: "https://a.co" },
      { type: "QUICK_REPLY", text: "Sí" },
    ]);
    expect(readStoredButtons(null)).toEqual([]);
  });
});
