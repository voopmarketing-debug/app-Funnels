import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema, SectionSchema, type WebsiteContentV2 } from "./websiteContentV2";
import { BLOCK_LIBRARY, applyBlockOp, carryOver, newSection } from "./websiteBlocks";

const page = (types: string[], hidden: number[] = []): WebsiteContentV2 =>
  WebsiteContentV2Schema.parse({
    version: 2,
    pageType: "servicios",
    style: "clinico",
    announcement: null,
    theme: { primaryColor: "#0f766e", backgroundColor: "#f6f8f7", surfaceColor: "#e9efed", textColor: "#13201d", headingFont: "Inter", bodyFont: "Inter" },
    sections: types.map((t, i) =>
      t === "hero"
        ? { type: "hero", variant: "centered", eyebrow: null, heading: "Hola", highlight: null, subheading: "x", chips: [], showLeadForm: false, ctaLabel: "Ir", secondaryCtaLabel: null, badge: null, productId: null }
        : { ...newSection(t as never, { firstProductId: "p1" })!, heading: `Bloque ${i}` },
    ),
    hidden,
    heroCtaUrl: null,
  });
const types = (c: WebsiteContentV2) => c.sections.map((s) => s.type);
const ok = (r: ReturnType<typeof applyBlockOp>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("block library", () => {
  it("every block in the library makes a valid section", () => {
    for (const b of BLOCK_LIBRARY) {
      const s = newSection(b.type, { firstProductId: "p1" });
      expect(s, b.type).not.toBeNull();
      expect(SectionSchema.safeParse(s).success, b.type).toBe(true);
    }
  });
  it("a spotlight needs a product to point at", () => {
    expect(newSection("productSpotlight")).toBeNull();
  });
});

describe("applyBlockOp", () => {
  const base = () => page(["hero", "features", "steps", "cta"], [2]);

  it("adds a block at a position and keeps hidden blocks hidden", () => {
    const r = ok(applyBlockOp(base(), { kind: "add", type: "promo", at: 2 }));
    expect(types(r.content)).toEqual(["hero", "features", "promo", "steps", "cta"]);
    expect(r.content.hidden).toEqual([3]);
    expect(r.focus).toBe(2);
  });
  it("adds at the end by default and never above the portada", () => {
    expect(types(ok(applyBlockOp(base(), { kind: "add", type: "cta" })).content).at(-1)).toBe("cta");
    expect(applyBlockOp(base(), { kind: "add", type: "cta", at: 0 }).ok).toBe(false);
  });
  it("duplicates right below, visible", () => {
    const r = ok(applyBlockOp(base(), { kind: "duplicate", index: 2 }));
    expect(types(r.content)).toEqual(["hero", "features", "steps", "steps", "cta"]);
    expect(r.content.hidden).toEqual([2]);
  });
  it("removes a block and shifts the hidden ones", () => {
    const r = ok(applyBlockOp(base(), { kind: "remove", index: 1 }));
    expect(types(r.content)).toEqual(["hero", "steps", "cta"]);
    expect(r.content.hidden).toEqual([1]);
    expect(applyBlockOp(base(), { kind: "remove", index: 0 }).ok).toBe(false);
  });
  it("moves a block anywhere but above the portada", () => {
    const r = ok(applyBlockOp(base(), { kind: "move", from: 1, to: 3 }));
    expect(types(r.content)).toEqual(["hero", "steps", "cta", "features"]);
    expect(r.content.hidden).toEqual([1]);
    expect(applyBlockOp(base(), { kind: "move", from: 2, to: 0 }).ok).toBe(false);
  });
  it("sets and clears a style", () => {
    const styled = ok(applyBlockOp(base(), { kind: "look", index: 1, patch: { bg: "#112233", padY: "lg" } })).content;
    expect(styled.sections[1].look).toEqual({ bg: "#112233", padY: "lg" });
    const cleared = ok(applyBlockOp(styled, { kind: "look", index: 1, patch: { bg: null, padY: null } })).content;
    expect(cleared.sections[1].look).toBeUndefined();
  });
  it("stops at the maximum", () => {
    const many = page(["hero", ...Array.from({ length: 29 }, () => "cta")]);
    expect(applyBlockOp(many, { kind: "add", type: "cta" }).ok).toBe(false);
  });
});

describe("carryOver", () => {
  it("gives the styling back after the AI rewrote the page", () => {
    const current = ok(applyBlockOp(page(["hero", "features", "steps"], [2]), { kind: "look", index: 1, patch: { bg: "#112233" } })).content;
    const rewritten = page(["hero", "steps", "features"]);
    rewritten.sections[1] = { ...rewritten.sections[1], heading: "Bloque 2" } as never;
    rewritten.sections[2] = { ...rewritten.sections[2], heading: "Bloque 1" } as never;
    const out = carryOver(current, rewritten);
    expect(out.sections[2].look).toEqual({ bg: "#112233" });
    expect(out.hidden).toEqual([1]);
  });
});
