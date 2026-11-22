import { describe, expect, it } from "vitest";
import { DESIGN_PALETTES, paletteHint, recommendPalette } from "./designIntel";

describe("designIntel", () => {
  it("picks the dealership palette for a car dealership", () => {
    expect(recommendPalette("Concesionario de carros usados en Medellín")?.type).toBe("Automotive/Car Dealership");
  });
  it("ignores accents and case", () => {
    expect(recommendPalette("Consultorio de ORTODONCIA y ODONTOLOGÍA")?.type).toBe("Dental Practice");
  });
  it("matches whole words only", () => {
    expect(recommendPalette("vendemos casacas de cuero")).toBeNull();
  });
  it("returns nothing, and an empty hint, when no row matches", () => {
    expect(recommendPalette("xyz")).toBeNull();
    expect(paletteHint("xyz")).toBe("");
  });
  it("hint tells the model that brand colors win", () => {
    expect(paletteHint("gimnasio crossfit")).toContain("usa los del cliente");
  });
  it("every palette has valid hex colors", () => {
    for (const p of DESIGN_PALETTES) for (const c of [p.primary, p.secondary, p.accent, p.bg, p.fg]) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
