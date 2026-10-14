import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema, type WebsiteContentV2 } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";

const base = {
  version: 2,
  pageType: "servicios",
  style: "clinico",
  announcement: "Valoración gratis",
  theme: { primaryColor: "#0f766e", backgroundColor: "#f6f8f7", surfaceColor: "#e9efed", textColor: "#13201d", headingFont: "Inter", bodyFont: "Inter" },
  sections: [
    { type: "hero", variant: "split", eyebrow: "Odontología", heading: "Tu sonrisa en 30 días", highlight: "en 30 días", subheading: "Sin dolor", chips: ["Lun a Sáb"], showLeadForm: false, ctaLabel: "Agenda", secondaryCtaLabel: null, badge: null, productId: null },
    { type: "features", variant: "cards", kicker: "Servicios", heading: "Lo que hacemos", intro: null, items: [{ icon: "check", title: "Blanqueamiento", description: "En una sesión" }] },
    { type: "objections", kicker: null, heading: "Dudas", items: [{ question: "¿Duele?", answer: "No" }] },
  ],
  hidden: [],
  heroCtaUrl: null,
};
const page = (patch: (c: typeof base) => unknown = () => undefined): WebsiteContentV2 => {
  const copy = structuredClone(base);
  patch(copy);
  return WebsiteContentV2Schema.parse(copy);
};
const ctx = { businessName: "Clínica", trackingBasePath: "/sitio/x", heroImageUrl: "https://img.example.com/hero.png" };

describe("renderWebsiteHtmlV2 editing markers", () => {
  it("adds none of them to the public page", () => {
    const html = renderWebsiteHtmlV2(page(), ctx);
    expect(html).not.toContain("data-edit");
    expect(html).not.toContain("data-sec");
    expect(html).not.toContain("data-img");
  });

  it("does not add them to a plain preview either", () => {
    expect(renderWebsiteHtmlV2(page(), { ...ctx, preview: true })).not.toContain("data-edit");
  });

  it("marks every text, picture and section in the builder's editing preview", () => {
    const html = renderWebsiteHtmlV2(page(), { ...ctx, preview: true, edit: true });
    for (const path of ["announcement", "sections.0.heading", "sections.0.eyebrow", "sections.0.subheading", "sections.0.ctaLabel", "sections.0.chips.0", "sections.1.kicker", "sections.1.heading", "sections.1.items.0.title", "sections.1.items.0.description", "sections.2.items.0.question", "sections.2.items.0.answer"]) {
      expect(html, path).toContain(`data-edit="${path}"`);
    }
    expect(html).toContain('data-img="0"');
    expect(html).toMatch(/<section[^>]*data-sec="1" data-type="features"/);
  });

  it("only marks the editing preview when it is also a preview", () => {
    expect(renderWebsiteHtmlV2(page(), { ...ctx, edit: true })).not.toContain("data-edit");
  });
});

describe("renderWebsiteHtmlV2 photos", () => {
  it("puts a background photo behind any block, with its readable colors", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[1], { bgImage: "https://img.example.com/fondo.jpg" })), ctx);
    expect(html).toMatch(/<section class="sec has-bg" id="detalles" style="--bgimg:url\('https:\/\/img\.example\.com\/fondo\.jpg'\)">/);
    expect(html).toContain(".has-bg{");
  });

  it("encodes anything in the url that could break out of the css", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[1], { bgImage: "https://img.example.com/a b');}body{display:none}.jpg" })), ctx);
    expect(html).toContain("--bgimg:url('https://img.example.com/a%20b%27%29;}body{display:none}.jpg')");
    expect(html).not.toContain("');}body");
  });

  it("keeps an & in the url intact inside the attribute", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[1], { bgImage: "https://img.example.com/a.jpg?x=1&y=2" })), ctx);
    expect(html).toContain("a.jpg?x=1&amp;y=2");
  });

  it("turns the portada into the full-photo one when it gets a background", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[0], { bgImage: "https://img.example.com/fondo.jpg" })), ctx);
    expect(html).toContain('class="hero hero-full"');
    expect(html).toContain("fondo.jpg");
    expect(html).not.toContain("has-bg\"");
  });

  it("uses the owner's own picture instead of the automatic one", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[0], { image: "https://img.example.com/mia.png" })), ctx);
    expect(html).toContain('<img src="https://img.example.com/mia.png"');
    expect(html).not.toContain("hero.png");
  });

  it("ignores photos that are not https", () => {
    const html = renderWebsiteHtmlV2(page((c) => Object.assign(c.sections[1], { bgImage: "javascript:alert(1)" })), ctx);
    expect(html).not.toContain("has-bg\"");
  });
});
