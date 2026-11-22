import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema, type CatalogProduct } from "./websiteContentV2";
import { ensureStructure } from "./websiteStructure";
import { contrastRatio, ensureContrast } from "./colorContrast";

const product = (n: number, over: Partial<CatalogProduct> = {}): CatalogProduct => ({ id: `p${n}`, name: `Auto ${n}`, description: "", price: n * 40_000_000, compareAtPrice: null, currency: "COP", category: null, imageUrl: `https://img.example.com/${n}.png`, badge: null, ...over });
const page = (pageType: string, extra: unknown[] = []) =>
  WebsiteContentV2Schema.parse({
    version: 2, pageType, style: "producto", announcement: null,
    theme: { primaryColor: "#a50f19", backgroundColor: "#ffffff", surfaceColor: "#f4f4f4", textColor: "#111111", headingFont: "Inter", bodyFont: "Inter" },
    sections: [
      { type: "hero", variant: "split", eyebrow: null, heading: "Tu carro", highlight: null, subheading: "Sub", chips: [], showLeadForm: false, ctaLabel: "Agenda", secondaryCtaLabel: null, badge: null, productId: null },
      { type: "trustBar", items: [{ icon: "shield", title: "Garantía de fábrica", description: "Directa" }, { icon: "truck", title: "Entrega coordinada", description: "Contigo" }, { icon: "chat", title: "Asesoría por WhatsApp", description: "Rápida" }] },
      { type: "features", variant: "cards", kicker: null, heading: "Beneficios", intro: null, items: [{ icon: "check", title: "Retoma", description: "Recibimos tu carro" }, { icon: "check", title: "Financiación", description: "Te asesoramos" }] },
      ...extra,
      { type: "leadForm", kicker: null, heading: "Agenda tu visita", body: "Te escribimos hoy.", buttonLabel: "Agendar" },
    ],
    hidden: [], heroCtaUrl: null,
  });
const types = (c: ReturnType<typeof page>) => c.sections.map((s) => s.type);

describe("ensureStructure", () => {
  it("fills the top bar from the page's own guarantees", () => {
    expect(ensureStructure(page("servicios"), []).announcement).toBe("Garantía de fábrica · Entrega coordinada · Asesoría por WhatsApp");
  });

  it("keeps the top bar the AI wrote", () => {
    expect(ensureStructure({ ...page("servicios"), announcement: "Horario de lunes a sábado" }, []).announcement).toBe("Horario de lunes a sábado");
  });

  it("adds the viewer and the quoter to a showroom with photos and prices", () => {
    const out = ensureStructure(page("showroom"), [product(1), product(2), product(3)]);
    expect(types(out)).toContain("showroom");
    expect(types(out)).toContain("quoter");
    expect(types(out).indexOf("quoter")).toBeLessThan(types(out).indexOf("leadForm"));
    expect(types(out).indexOf("showroom")).toBe(1);
  });

  it("does not add interactive blocks when the catalog cannot fill them", () => {
    const out = ensureStructure(page("showroom"), [product(1, { imageUrl: null, price: null })]);
    expect(types(out)).not.toContain("showroom");
    expect(types(out)).not.toContain("quoter");
  });

  it("adds the collection fan to a brand-story page", () => {
    expect(types(ensureStructure(page("historia"), [product(1), product(2)]))).toContain("fan");
  });

  it("leaves an existing centerpiece alone", () => {
    const withFan = page("historia", [{ type: "fan", kicker: null, heading: "Colección", intro: null, productIds: [] }]);
    expect(types(ensureStructure(withFan, [product(1), product(2)])).filter((t) => t === "fan")).toHaveLength(1);
  });

  it("adds a promotion banner from the closing invitation, with no invented countdown or seal", () => {
    const out = ensureStructure(page("servicios"), []);
    const promo = out.sections.find((s) => s.type === "promo");
    expect(promo).toMatchObject({ type: "promo", heading: "Agenda tu visita", ctaLabel: "Agendar" });
    expect(promo).not.toHaveProperty("countdown");
    expect(promo).not.toHaveProperty("seal");
  });

  it("does not add a second banner", () => {
    const withPromo = page("servicios", [{ type: "promo", tone: "accent", kicker: null, heading: "Oferta", body: "Condiciones", ctaLabel: "Quiero" }]);
    expect(ensureStructure(withPromo, []).sections.filter((s) => s.type === "promo")).toHaveLength(1);
  });

  it("keeps the hero first and the result valid", () => {
    const out = ensureStructure(page("showroom"), [product(1), product(2)]);
    expect(out.sections[0].type).toBe("hero");
    expect(WebsiteContentV2Schema.safeParse(out).success).toBe(true);
  });
});

describe("ensureContrast", () => {
  it("leaves a readable color alone", () => {
    expect(ensureContrast("#111111", "#ffffff", 7)).toBe("#111111");
  });

  it("darkens mint text on white until it reads", () => {
    const fixed = ensureContrast("#1fd896", "#ffffff", 7);
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(fixed).not.toBe("#1fd896");
  });

  it("lightens dark text on a dark background", () => {
    expect(contrastRatio(ensureContrast("#222222", "#101010", 7), "#101010")).toBeGreaterThanOrEqual(7);
  });
});
