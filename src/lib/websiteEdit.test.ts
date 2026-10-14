import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema, type WebsiteContentV2 } from "./websiteContentV2";
import { setSectionImage, setTextAtPath } from "./websiteEdit";

const content: WebsiteContentV2 = WebsiteContentV2Schema.parse({
  version: 2,
  pageType: "servicios",
  style: "editorial",
  announcement: "Envío gratis",
  theme: { primaryColor: "#1f6feb", backgroundColor: "#fafaf7", surfaceColor: "#f1f0eb", textColor: "#141414", headingFont: "Inter", bodyFont: "Inter" },
  sections: [
    { type: "hero", variant: "split", eyebrow: "Odontología", heading: "Sonrisas en 30 días", highlight: "en 30 días", subheading: "Tratamientos sin dolor", chips: ["Lun a Sáb", "Cali"], showLeadForm: false, ctaLabel: "Agenda hoy", secondaryCtaLabel: null, badge: null, productId: null },
    { type: "features", variant: "cards", kicker: null, heading: "Lo que hacemos", intro: null, items: [{ icon: "check", title: "Blanqueamiento", description: "En una sesión" }] },
    { type: "host", kicker: null, heading: "Quién eres", name: "Dra. Ana", role: "Ortodoncista", body: "Línea 1\nLínea 2" },
  ],
  hidden: [],
  heroCtaUrl: null,
});

describe("setTextAtPath", () => {
  it("edits a heading and drops the highlight that is no longer in it", () => {
    const r = setTextAtPath(content, "sections.0.heading", "  Sonrisas   nuevas  ");
    expect(r.ok && r.content.sections[0]).toMatchObject({ heading: "Sonrisas nuevas", highlight: null });
  });

  it("keeps the highlight while its words are still there", () => {
    const r = setTextAtPath(content, "sections.0.heading", "Estrena sonrisa en 30 días");
    expect(r.ok && r.content.sections[0]).toMatchObject({ highlight: "en 30 días" });
  });

  it("edits items, chips and the announcement bar", () => {
    const a = setTextAtPath(content, "sections.1.items.0.title", "Limpieza");
    expect(a.ok && (a.content.sections[1] as { items: { title: string }[] }).items[0].title).toBe("Limpieza");
    const b = setTextAtPath(content, "sections.0.chips.1", "Popayán");
    expect(b.ok && (b.content.sections[0] as { chips: string[] }).chips).toEqual(["Lun a Sáb", "Popayán"]);
    const c = setTextAtPath(content, "announcement", "");
    expect(c.ok && c.content.announcement).toBeNull();
  });

  it("removes an emptied chip and an emptied optional text, but refuses to empty a required one", () => {
    const chip = setTextAtPath(content, "sections.0.chips.0", "  ");
    expect(chip.ok && (chip.content.sections[0] as { chips: string[] }).chips).toEqual(["Cali"]);
    const eyebrow = setTextAtPath(content, "sections.0.eyebrow", "");
    expect(eyebrow.ok && (eyebrow.content.sections[0] as { eyebrow: string | null }).eyebrow).toBeNull();
    expect(setTextAtPath(content, "sections.0.heading", "   ")).toEqual({ ok: false, error: "Este texto no puede quedar vacío." });
  });

  it("keeps line breaks only where the text is a paragraph", () => {
    const body = setTextAtPath(content, "sections.2.body", "Hola\n\n\n\nmundo");
    expect(body.ok && (body.content.sections[2] as { body: string }).body).toBe("Hola\n\nmundo");
    const name = setTextAtPath(content, "sections.2.name", "Dra.\nAna");
    expect(name.ok && (name.content.sections[2] as { name: string }).name).toBe("Dra. Ana");
  });

  it("rejects anything that is not a plain text field of this page", () => {
    for (const path of ["sections.0.type", "sections.0.variant", "sections.0.productId", "sections.9.heading", "sections.0.__proto__", "sections.1.items.0.icon", "sections.1.items.7.title", "hidden", "theme.primaryColor", "sections.0.heading.x", "../x"]) {
      expect(setTextAtPath(content, path, "x").ok, path).toBe(false);
    }
  });

  it("does not modify the content it was given", () => {
    const before = JSON.stringify(content);
    setTextAtPath(content, "sections.0.heading", "Otro");
    expect(JSON.stringify(content)).toBe(before);
  });
});

describe("setSectionImage", () => {
  it("sets and clears a background photo", () => {
    const set = setSectionImage(content, 1, "bgImage", "https://cdn.example.com/a.jpg");
    expect(set && (set.sections[1] as { bgImage?: string }).bgImage).toBe("https://cdn.example.com/a.jpg");
    const cleared = set && setSectionImage(set, 1, "bgImage", null);
    expect(cleared && "bgImage" in cleared.sections[1]).toBe(false);
  });

  it("refuses a section that does not exist and urls that are not https", () => {
    expect(setSectionImage(content, 9, "image", "https://x.com/a.jpg")).toBeNull();
    expect(setSectionImage(content, 0, "image", "http://x.com/a.jpg")?.sections[0]).not.toHaveProperty("image", "http://x.com/a.jpg");
  });
});
