import { describe, expect, it } from "vitest";
import { ShowroomSchema, StorySchema } from "./content";
import { renderShowroom } from "./showroom";
import { renderStory } from "./story";
import { setTemplateTextAtPath } from "./edit";

const showroom = ShowroomSchema.parse({
  version: 3, template: "showroom", brand: { name: "Vértice", accent: "#3457ff" }, noun: "carro", ticker: [],
  promo: { tag: "Solo en {mes}", title: "Bono por tu usado", text: "Trae tu carro.", cta: "Quiero el bono", stamp: null, countdown: false },
  hero: { title: "Tu próximo carro", text: "Gíralo y cotiza.", primaryCta: "Cotizar", secondaryCta: "Agendar" },
  items: [],
  quote: { kicker: "Cotizador", title: "¿Cuánto?", text: "Mueve la barra.", months: 60, ratePct: null, downPct: 0 },
  services: { kicker: "Servicios", title: "Más fácil", text: "", cards: [{ icon: "card", title: "Crédito", text: "Rápido" }], trade: null, side: [] },
  visit: { kicker: "Visita", title: "Agenda", text: "", where: [], button: "Pedir" },
  footer: "",
});
const story = StorySchema.parse({
  version: 3, template: "story", brand: { name: "Alba", accent: "#8a73c9" }, ticker: [],
  promo: { tag: "Solo en {mes}", title: "Plan", text: "", cta: "Quiero", stamp: null, countdown: false },
  hero: { kicker: "Piel", title: "Tu piel merece un plan", text: "Medicina estética.", primaryCta: "Agendar", secondaryCta: "Ver", trust: [] },
  ritual: { title: "El ritual", text: "", link: "Conoce", benefits: [{ title: "Ilumina", text: "Niacinamida" }], spec: [] },
  marquee: { rows: [], tags: [] }, inside: null, collection: { kicker: "La colección", title: "Tres" }, items: [],
  visit: { title: "Tu visita", text: "", steps: [{ title: "Valoración", text: "Revisamos", meta: "30 min" }] },
  book: { title: "En buenas manos", text: "", facts: [], button: "Pedir" }, footer: "",
});
const ctx = { businessName: "X", trackingBasePath: "#", products: [] };

describe("Showroom / Scroll Story click-to-edit", () => {
  it("marks the editable texts only in the builder's preview, and shows {mes} as written there", () => {
    const plain = renderShowroom(showroom, ctx);
    expect(plain).not.toContain("data-edit=");
    const edit = renderShowroom(showroom, { ...ctx, edit: true });
    for (const path of ["hero.title", "hero.text", "promo.title", "services.cards.0.title", "visit.title"]) expect(edit, path).toContain(`data-edit="${path}"`);
    expect(edit).toContain("Solo en {mes}");
    const s = renderStory(story, { ...ctx, edit: true });
    for (const path of ["hero.title", "ritual.benefits.0.title", "visit.steps.0.meta", "book.title"]) expect(s, path).toContain(`data-edit="${path}"`);
    expect(renderStory(story, ctx)).not.toContain("data-edit=");
  });

  it("edits a text and nothing else, by path", () => {
    const r = setTemplateTextAtPath(showroom, "hero.title", "  Nuevo   titular ");
    expect(r.ok && r.content.template === "showroom" && r.content.hero.title).toBe("Nuevo titular");
    const c = setTemplateTextAtPath(showroom, "services.cards.0.text", "Mucho más rápido");
    expect(c.ok && c.content.template === "showroom" && c.content.services.cards[0].text).toBe("Mucho más rápido");
    const st = setTemplateTextAtPath(story, "visit.steps.0.meta", "");
    expect(st.ok && st.content.template === "story" && st.content.visit.steps[0].meta).toBe("");
  });

  it("refuses what is not a plain text field", () => {
    for (const path of ["template", "brand.accent", "brand.name", "hero.primaryCta", "items.0.productId", "services.cards.0.icon", "services.cards.9.title", "hero", "__proto__.title", "hero.title.x", "a.b.c.d.e.f"]) {
      expect(setTemplateTextAtPath(showroom, path, "x").ok, path).toBe(false);
    }
    expect(setTemplateTextAtPath(showroom, "hero.title", "   ")).toEqual({ ok: false, error: "Este texto no puede quedar vacío." });
  });
});
