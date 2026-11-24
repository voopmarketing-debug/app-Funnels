import { describe, expect, it } from "vitest";
import { NICHE_TEMPLATES, buildNicheContent, getNicheTemplate } from "./websiteNicheTemplates";
import { WebsiteContentV2Schema } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";

describe("niche templates", () => {
  it("has the three launch niches with unique ids", () => {
    expect(NICHE_TEMPLATES.map((t) => t.id)).toEqual(["contadores", "esteticas", "odontologos"]);
    expect(new Set(NICHE_TEMPLATES.map((t) => t.id)).size).toBe(NICHE_TEMPLATES.length);
    expect(getNicheTemplate("nope")).toBeNull();
  });

  for (const t of NICHE_TEMPLATES) {
    describe(t.id, () => {
      const content = buildNicheContent(t, { businessName: "Vértice", brandColor: null });

      it("is valid stored content, and round-trips unchanged", () => {
        expect(WebsiteContentV2Schema.parse(content)).toEqual(content);
      });

      it("starts with a hero whose highlight is really in its heading", () => {
        const hero = content.sections[0];
        expect(hero.type).toBe("hero");
        if (hero.type === "hero") expect(hero.highlight && hero.heading.includes(hero.highlight)).toBeTruthy();
      });

      it("ends with a form, so every page can capture a contact", () => {
        expect(content.sections.at(-1)?.type).toBe("leadForm");
      });

      it("uses the business name and never leaves a placeholder", () => {
        const json = JSON.stringify(content);
        expect(json).toContain("Vértice");
        expect(json).not.toMatch(/\{(nombre|negocio|ciudad)\}|[Ll]orem|TODO:/);
      });

      it("makes no promises with numbers: no prices, percentages or years", () => {
        const text = JSON.stringify(content.sections);
        expect(text).not.toMatch(/\$\s?\d|\d\s?%|\d+\s+años|desde \d/i);
      });

      it("renders a full page with the business name", () => {
        const html = renderWebsiteHtmlV2(content, { businessName: "Vértice", trackingBasePath: "#", preview: true, heroImageUrl: null, photos: [], products: [] });
        expect(html).toContain("Vértice");
        expect(html).toContain(t.id === "contadores" ? "Tu contabilidad al día" : t.id === "esteticas" ? "Luce y siéntete bien" : "Una sonrisa sana");
      });

      it("takes the owner's brand color over its own", () => {
        expect(buildNicheContent(t, { businessName: "X", brandColor: "#112233" }).theme.primaryColor).toBe("#112233");
        expect(buildNicheContent(t, { businessName: "X", brandColor: "nope" }).theme.primaryColor).toBe(t.accent);
      });
    });
  }
});
