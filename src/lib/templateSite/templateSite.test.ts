import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { ShowroomSchema, StorySchema, TemplateSiteSchema, isTemplateContent, templateForPageType } from "./content";
import { renderShowroom } from "./showroom";
import { renderStory } from "./story";
import { SHOWROOM_CLIENT_SOURCE, STORY_CLIENT_SOURCE } from "./clientScripts.generated";
import { addScriptHashes, inlineScriptHashes } from "../siteCsp";
import { withSiteTracking } from "../siteTracking";
import type { CatalogProduct } from "../websiteContentV2";

const product = (n: number, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: `p${n}`, name: `Auto ${n}`, description: "Motor eficiente", price: n * 50_000_000, compareAtPrice: null, currency: "COP", category: "SUV",
  imageUrl: `https://img.example.com/${n}.png`, badge: null, ...over,
});
const products = [1, 2, 3].map((n) => product(n));
const ctx = { businessName: "Vértice", trackingBasePath: "/sitio/x", products };

const showroom = ShowroomSchema.parse({
  version: 3, template: "showroom", brand: { name: "Vértice", accent: "#3457ff" }, noun: "carro", ticker: ["Prueba de manejo sin costo", "Entrega con papeles"],
  promo: { tag: "Solo en {mes}", title: "Bono por tu usado", text: "Trae tu carro.", cta: "Quiero el bono", stamp: "+$5 M", countdown: true },
  hero: { title: "Tu próximo carro, sin vueltas.", text: "Gíralo y cotiza.", primaryCta: "Cotizar", secondaryCta: "Agendar prueba" },
  items: [{ productId: "p1", sub: "Sedán", stats: [{ icon: "gauge", label: "Potencia", value: "158 hp" }], bubbles: [{ title: "Faros LED", text: "Automáticos" }] }],
  quote: { kicker: "Cotizador", title: "¿Cuánto quieres invertir?", text: "Mueve la barra.", months: 60, ratePct: null, downPct: 0 },
  services: { kicker: "Servicios", title: "Más fácil", text: "", cards: [{ icon: "card", title: "Crédito", text: "En 24 horas" }], trade: null, side: [] },
  visit: { kicker: "Visita", title: "Agenda tu visita", text: "", where: [], button: "Pedir mi visita" },
  footer: "",
});
const story = StorySchema.parse({
  version: 3, template: "story", brand: { name: "Alba", accent: "#8a73c9" }, ticker: ["Plan por escrito"],
  promo: { tag: "Solo en {mes}", title: "15 % en tu primer plan", text: "", cta: "Quiero mi 15 %", stamp: null, countdown: false },
  hero: { kicker: "Piel", title: "Tu piel merece un plan", text: "Medicina estética.", primaryCta: "Agendar", secondaryCta: "Ver tratamientos", trust: [] },
  ritual: { title: "El ritual empieza.", text: "", link: "Conoce la fórmula", benefits: [{ title: "Ilumina", text: "Niacinamida" }], spec: [] },
  marquee: { rows: ["Piel con calma"], tags: [] }, inside: null, collection: { kicker: "La colección", title: "Tres opciones" }, items: [],
  visit: { title: "Tu primera visita.", text: "", steps: [{ title: "Valoración", text: "Revisamos tu piel", meta: "30 min" }] },
  book: { title: "Tu piel, en buenas manos.", text: "", facts: [], button: "Pedir mi cita" }, footer: "",
});
const markup = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

describe("template site content", () => {
  it("recognizes template pages and maps the page types", () => {
    expect(isTemplateContent({ version: 3 })).toBe(true);
    expect(isTemplateContent({ version: 2 })).toBe(false);
    expect(templateForPageType("showroom")).toBe("showroom");
    expect(templateForPageType("historia")).toBe("story");
    expect(templateForPageType("tienda")).toBeNull();
  });

  it("round-trips through the union schema", () => {
    expect(TemplateSiteSchema.parse(showroom)).toEqual(showroom);
    expect(TemplateSiteSchema.parse(story)).toEqual(story);
  });

  it("fills safe defaults when the AI leaves fields out", () => {
    const sparse = ShowroomSchema.parse({ version: 3, template: "showroom", brand: {}, promo: {}, hero: {}, quote: {}, services: {}, visit: {} });
    expect(sparse.quote.months).toBe(48);
    expect(sparse.quote.ratePct).toBeNull();
    expect(sparse.quote.downPct).toBe(0);
    expect(sparse.promo.countdown).toBe(false);
  });
});

describe("browser scripts", () => {
  it("ship exactly what the *Client.ts files compile to (run npm run build:site-scripts when this fails)", () => {
    const compile = (file: string) =>
      transformSync(readFileSync(new URL(`./${file}`, import.meta.url), "utf8"), { loader: "ts", target: "es2019", format: "esm" })
        .code.replace(/^export function /m, "function ")
        .replace(/\nexport \{[^}]*\};?\s*$/, "")
        .trim();
    expect(SHOWROOM_CLIENT_SOURCE).toBe(compile("showroomClient.ts"));
    expect(STORY_CLIENT_SOURCE).toBe(compile("storyClient.ts"));
  });

  it("are plain, self-contained JavaScript", () => {
    for (const src of [SHOWROOM_CLIENT_SOURCE, STORY_CLIENT_SOURCE]) {
      expect(src).not.toMatch(/\bexport\b|\bimport\b|__name/);
      expect(() => new Function("D", `(${src})(D)`)).not.toThrow();
    }
  });
});

describe("renderShowroom", () => {
  const html = renderShowroom(showroom, ctx);

  it("renders the template's pieces", () => {
    for (const piece of ['id="stage"', 'id="chips"', 'id="cotizador"', 'id="promo"', 'id="bookForm"', 'class="ticker"', 'id="site-data"']) expect(html).toContain(piece);
    expect(html).toContain('<meta name="color-scheme" content="light">');
  });

  it("carries one inline script plus the data block, both safe", () => {
    expect(inlineScriptHashes(html)).toHaveLength(1);
    expect(html).toContain('<script type="application/json" id="site-data">');
    const evil = renderShowroom({ ...showroom, hero: { ...showroom.hero, title: "</script><script>alert(1)</script>" } }, ctx);
    expect(inlineScriptHashes(evil)).toHaveLength(1);
    expect(evil).not.toContain("<script>alert(1)");
  });

  it("posts the form to the page's lead capture with the consent box", () => {
    expect(html).toContain('action="/sitio/x/registro"');
    expect(html).toContain('name="consent"');
    expect(html).toContain('name="contact"');
    expect(html).toContain('id="f-msg"');
  });

  it("turns the countdown, month and stamp on from the data", () => {
    expect(html).toContain('id="cd-d"');
    expect(html).toContain("<span data-month>");
    expect(html).toContain("+$5 M");
    expect(markup(renderShowroom({ ...showroom, promo: { ...showroom.promo, countdown: false, stamp: null } }, ctx))).not.toContain('id="cd-d"');
  });

  it("leaves out the quoter when fewer than two products have a price", () => {
    expect(markup(renderShowroom(showroom, { ...ctx, products: [product(1)] }))).not.toContain('id="cotizador"');
  });

  it("shows no viewer without product photos (only a hint in the preview)", () => {
    const none = renderShowroom(showroom, { ...ctx, products: [product(1, { imageUrl: null })] });
    expect(markup(none)).not.toContain('id="stage"');
    expect(markup(renderShowroom(showroom, { ...ctx, products: [], preview: true }))).toContain("Carga tus productos");
  });

  it("only uses https photos", () => {
    const html2 = renderShowroom(showroom, { ...ctx, products: [product(1, { imageUrl: "javascript:alert(1)", galleryUrls: ["http://x.test/a.png"] })] });
    expect(html2).not.toContain("javascript:");
    expect(markup(html2)).not.toContain("http://x.test");
  });

  it("keeps the accent readable on its filled shapes", () => {
    expect(renderShowroom({ ...showroom, brand: { ...showroom.brand, accent: "#ffe14d" } }, ctx)).toContain("--accent-on:#0f1012");
    expect(html).toContain("--accent-on:#ffffff");
  });
});

describe("renderStory", () => {
  const html = renderStory(story, { ...ctx, products });

  it("renders the template's pieces", () => {
    for (const piece of ['id="flyer"', "data-anchor", 'id="fan"', 'id="sheet"', 'class="marquee"', 'id="promo"', 'id="bookForm"', 'class="big"']) expect(html).toContain(piece);
  });

  it("uses the first product photo as the traveling product", () => {
    expect(html).toContain('id="flyer" src="https://img.example.com/1.png"');
    expect(html.match(/data-anchor/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves out the ingredients when there are none and the collection without photos", () => {
    expect(markup(html)).not.toContain('id="ingredientes"');
    const bare = renderStory(story, { ...ctx, products: [product(1, { imageUrl: null })] });
    expect(markup(bare)).not.toContain('id="fan"');
    expect(markup(bare)).not.toContain('id="flyer"');
  });

  it("builds the giant word from the brand", () => {
    expect(html).toContain('<div class="big" aria-hidden="true">ALBA</div>');
  });
});

describe("policy for the page's own scripts", () => {
  it("allows exactly the inline scripts of a page and keeps everything else blocked", () => {
    const page = renderShowroom(showroom, ctx);
    const out = withSiteTracking(page, { "Content-Security-Policy": "default-src 'self'; script-src 'none'; img-src https:" }, { metaPixelId: null, googleTagId: null });
    const csp = out.headers["Content-Security-Policy"];
    const [hash] = inlineScriptHashes(page);
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    expect(csp).not.toContain("'none'");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("keeps the tracking nonce next to the page's script", () => {
    const page = renderStory(story, { ...ctx, products });
    const csp = withSiteTracking(page, {}, { metaPixelId: "123456789012345", googleTagId: null }).headers["Content-Security-Policy"];
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
    expect(csp).toContain(`'sha256-${inlineScriptHashes(page)[0]}'`);
  });

  it("leaves a policy alone when the page has no inline script", () => {
    expect(addScriptHashes("default-src 'self'; script-src 'none'", [])).toBe("default-src 'self'; script-src 'none'");
  });
});
