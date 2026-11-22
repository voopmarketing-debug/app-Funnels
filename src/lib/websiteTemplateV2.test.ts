import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema, type WebsiteContentV2 } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";
import { SITE_SCRIPT, SITE_SCRIPT_HASH } from "./siteScript";
import { SITE_CSP } from "./securityHeaders";
import { createHash } from "node:crypto";

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

const products = [1, 2, 3].map((n) => ({ id: `p${n}`, name: `Auto ${n}`, description: "Motor eficiente", price: n * 50_000_000, compareAtPrice: null, currency: "COP", category: "SUV", imageUrl: `https://img.example.com/p${n}.png`, badge: null }));
// The page markup only: the style and the script legitimately mention every block.
const markup = (html: string) => html.replace(/<script>[\s\S]*?<\/script>/, "").replace(/<style>[\s\S]*?<\/style>/, "");
const withBlocks = (extra: unknown[]) => page((c) => { c.sections.push(...(extra as never[])); });

describe("renderWebsiteHtmlV2 page script", () => {
  it("runs the one fixed script, allowed by its hash in the page policy", () => {
    const html = renderWebsiteHtmlV2(page(), ctx);
    expect(html).toContain(`<script>${SITE_SCRIPT}</script>`);
    expect(createHash("sha256").update(SITE_SCRIPT).digest("base64")).toBe(SITE_SCRIPT_HASH);
    expect(SITE_CSP).toContain(`script-src 'sha256-${SITE_SCRIPT_HASH}'`);
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("never puts business content inside the script", () => {
    const html = renderWebsiteHtmlV2(page((c) => { c.announcement = "</script><script>alert(1)</script>"; }), ctx);
    expect(html).not.toContain("<script>alert(1)");
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("turns off the reveal animation inside the builder's editing preview", () => {
    expect(renderWebsiteHtmlV2(page(), { ...ctx, preview: true, edit: true })).toContain('data-fx="off"');
    expect(markup(renderWebsiteHtmlV2(page(), ctx))).not.toContain("data-fx");
  });

  it("pins the page to the light theme", () => {
    const html = renderWebsiteHtmlV2(page(), ctx);
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain("color-scheme:light");
  });
});

describe("renderWebsiteHtmlV2 top bar and promo", () => {
  it("scrolls the phrases of the top bar", () => {
    const html = renderWebsiteHtmlV2(page((c) => { c.announcement = "Envío gratis · Garantía de 3 años"; }), ctx);
    expect(html).toContain("annc-run");
    expect(html).toContain("<span>Garantía de 3 años</span>");
  });

  it("keeps the top bar editable and still in the editing preview", () => {
    const html = renderWebsiteHtmlV2(page((c) => { c.announcement = "Envío gratis · Garantía"; }), { ...ctx, preview: true, edit: true });
    expect(markup(html)).not.toContain("annc-run");
    expect(html).toContain('data-edit="announcement"');
  });

  it("shows the countdown, the seal and the current month on a promo", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "promo", tone: "accent", kicker: "Solo en {mes}", heading: "Oferta", body: "Condiciones", ctaLabel: "Quiero", countdown: true, seal: "-15 %" }]), { ...ctx, products });
    expect(html).toContain("data-countdown");
    expect(html).toContain('class="seal"');
    expect(html).toContain("<span data-month>");
    expect(html).not.toContain("{mes}");
  });

  it("leaves the plain promo strip as it was", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "promo", tone: "dark", kicker: null, heading: "Oferta", body: "Condiciones", ctaLabel: "Quiero" }]), ctx);
    expect(markup(html)).toContain("promo-inner");
    expect(markup(html)).not.toContain("data-countdown");
  });
});

describe("renderWebsiteHtmlV2 interactive blocks", () => {
  it("renders the product viewer with thumbnails, bubbles and facts", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "showroom", kicker: null, heading: "Míralo", productIds: [], bubbles: [{ title: "Garantía", description: "3 años" }], facts: [{ title: "Entrega", description: "Inmediata" }] }]), { ...ctx, products });
    expect(html).toContain("data-showroom");
    expect(html.match(/data-thumb="/g)).toHaveLength(3);
    expect(html).toContain("shw-bubbles");
    expect(html).toContain("shw-chat");
    expect(html).toContain("shw-facts");
  });

  it("renders nothing in the public page when there are no products with a photo", () => {
    const section = { type: "showroom", kicker: null, heading: "Míralo", productIds: [], bubbles: [], facts: [] };
    expect(markup(renderWebsiteHtmlV2(withBlocks([section]), ctx))).not.toContain("data-showroom");
    expect(renderWebsiteHtmlV2(withBlocks([section]), { ...ctx, preview: true })).toContain("empty-note");
  });

  it("renders the quoter with every priced product and the simulation notice", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "quoter", kicker: null, heading: "Cotiza", intro: null, productIds: [], months: 36, note: null }]), { ...ctx, products });
    expect(html).toContain("data-quoter");
    expect(html).toContain('data-months="36"');
    expect(html.match(/data-qprice="/g)).toHaveLength(3);
    expect(html).toContain("Simulación de referencia");
  });

  it("needs at least two priced products for the quoter", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "quoter", kicker: null, heading: "Cotiza", intro: null, productIds: [], months: 36, note: null }]), { ...ctx, products: products.slice(0, 1) });
    expect(markup(html)).not.toContain("data-quoter");
  });

  it("links each quoter row to the viewer when the page has one", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "showroom", kicker: null, heading: "V", productIds: [], bubbles: [], facts: [] }, { type: "quoter", kicker: null, heading: "Cotiza", intro: null, productIds: [], months: 48, note: null }]), { ...ctx, products });
    expect(html).toContain('data-view="p1"');
  });

  it("renders the fan and the moving text", () => {
    const html = renderWebsiteHtmlV2(withBlocks([{ type: "fan", kicker: null, heading: "Colección", intro: null, productIds: [] }, { type: "marquee", lines: ["Hecho con cuidado", "Elegido"] }]), { ...ctx, products });
    expect(html).toContain("data-fan");
    expect(html.match(/data-fcard="/g)).toHaveLength(3);
    expect(html).toContain("mq-row rev");
  });

  it("marks the blocks that rise into view", () => {
    const html = renderWebsiteHtmlV2(page(), ctx);
    expect(html).toContain('class="feat-item rv"');
  });
});
