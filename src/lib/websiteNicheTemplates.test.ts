import { describe, expect, it } from "vitest";
import { NICHES, TEMPLATES_PER_NICHE, buildNicheContent, getNicheTemplate, listTemplateCards } from "./websiteNicheTemplates";
import { BLUEPRINTS } from "./nicheTemplates/blueprints";
import { STYLE_KEYS, WebsiteContentV2Schema } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";

const cards = listTemplateCards();

describe("niche template library", () => {
  it("has at least 12 templates per niche, 12 blueprints, and a unique id for each", () => {
    expect(TEMPLATES_PER_NICHE).toBeGreaterThanOrEqual(12);
    expect(NICHES.length).toBeGreaterThanOrEqual(8);
    expect(cards).toHaveLength(NICHES.length * TEMPLATES_PER_NICHE);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const niche of NICHES) expect(cards.filter((c) => c.nicheId === niche.id)).toHaveLength(TEMPLATES_PER_NICHE);
  });

  it("resolves ids and rejects anything else", () => {
    expect(getNicheTemplate("contadores-01")?.niche.id).toBe("contadores");
    expect(getNicheTemplate("odontologos-12")?.index).toBe(11);
    for (const bad of ["contadores", "contadores-13", "contadores-00", "nope-01", "contadores-1", "../x"]) expect(getNicheTemplate(bad)).toBeNull();
  });

  it("makes the twelve templates of a niche different in structure and in look", () => {
    for (const niche of NICHES) {
      const mine = cards.filter((c) => c.nicheId === niche.id);
      expect(new Set(mine.map((c) => c.style)).size).toBe(12); // every style once
      expect(new Set(mine.map((c) => c.shape.join(">"))).size).toBe(12); // every arrangement different
      expect(new Set(mine.map((c) => c.heading)).size).toBe(12); // every opening different
      expect(niche.styleOrder.slice().sort()).toEqual([...STYLE_KEYS].sort());
    }
  });
});

describe("every template", () => {
  for (const niche of NICHES) {
    for (let index = 0; index < TEMPLATES_PER_NICHE; index++) {
      const id = `${niche.id}-${String(index + 1).padStart(2, "0")}`;
      describe(id, () => {
        const template = { niche, index };
        const content = buildNicheContent(template, { businessName: "Vértice", brandColor: null });
        const sections = content.sections;

        it("is valid stored content that round-trips unchanged", () => {
          expect(WebsiteContentV2Schema.parse(content)).toEqual(content);
        });

        it("opens with a hero whose highlight is really in its heading, within the limits", () => {
          const hero = sections[0];
          expect(hero.type).toBe("hero");
          if (hero.type !== "hero") return;
          expect(hero.heading.length).toBeLessThanOrEqual(hero.variant === "giant" ? 45 : 72);
          expect(hero.highlight && hero.heading.includes(hero.highlight)).toBeTruthy();
          expect(hero.subheading.length).toBeLessThanOrEqual(180);
          expect(hero.ctaLabel.length).toBeLessThanOrEqual(30);
        });

        it("converts: a contact path (form, form in the hero or WhatsApp button), the main button repeated, and an answer to doubts", () => {
          const hero = sections[0];
          const hasContact = sections.some((s) => s.type === "leadForm" || s.type === "cta") || (hero.type === "hero" && hero.showLeadForm);
          expect(hasContact).toBe(true);
          expect(["leadForm", "cta"]).toContain(sections.at(-1)?.type); // the page ends on the action
          const buttons = sections.filter((s) => s.type === "hero" || s.type === "cta" || s.type === "promo" || s.type === "leadForm").length;
          expect(buttons).toBeGreaterThanOrEqual(2);
          expect(sections.some((s) => s.type === "objections" || s.type === "steps")).toBe(true);
          expect(sections.length).toBeGreaterThanOrEqual(4);
          expect(sections.length).toBeLessThanOrEqual(12);
        });

        it("leaves no placeholder, and invents no numbers, prices or claims", () => {
          const json = JSON.stringify(sections);
          expect(json).not.toMatch(/\{[a-z]+\}|[Ll]orem|TODO:/);
          expect(json).not.toMatch(/\d/); // no prices, percentages, years, counts
          expect(json).not.toMatch(/garantizad|el mejor (precio|servicio|abogado|dentista|contador|gimnasio|centro|veterinari)|número uno|mejor precio/i);
        });

        it("renders a full page", () => {
          const html = renderWebsiteHtmlV2(content, { businessName: "Vértice", trackingBasePath: "#", preview: true, heroImageUrl: null, photos: [], products: [] });
          expect(html).toContain("Vértice");
          expect(html.length).toBeGreaterThan(5000);
        });
      });
    }
  }

  it("takes the owner's brand color over the style's", () => {
    const t = { niche: NICHES[0], index: 0 };
    expect(buildNicheContent(t, { businessName: "X", brandColor: "#112233" }).theme.primaryColor).toBe("#112233");
    expect(buildNicheContent(t, { businessName: "X", brandColor: "nope" }).theme.primaryColor).not.toBe("nope");
  });

  it("the blueprints fit the card shape", () => {
    for (const bp of BLUEPRINTS) {
      const built = bp.build(NICHES[0], NICHES[0].angles[0], "X").map((s) => s.type);
      expect(built).toEqual(bp.shape);
    }
  });
});
