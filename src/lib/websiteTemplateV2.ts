import { SERIF_FONTS } from "@/lib/websiteContent";
import { readableTextColor, sanitizeHexColor } from "@/lib/websiteTemplate";
import {
  formatMoney,
  type CatalogProduct,
  type Section,
  type StyleKey,
  type WebsiteContentV2,
} from "@/lib/websiteContentV2";

// Renders a version-2 page (see websiteContentV2.ts). Static HTML + CSS
// only — public pages ship with `script-src 'none'` (securityHeaders.ts),
// so everything interactive here is CSS/HTML-native: <details> for FAQs,
// anchors for category tabs, scroll-snap for product rows.

function esc(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https:\/\//.test(url) ? url : null;
}

// Each style is a set of shape/typography decisions layered on the AI's
// own colors and fonts, so two pages with the same palette still read as
// different design languages.
type StylePreset = {
  radius: string;
  btnRadius: string;
  headingWeight: number;
  headingTransform: "none" | "uppercase";
  headingTracking: string;
  h1: string;
  h2: string;
  sectionPad: string;
  cardBorder: boolean;
  cardShadow: boolean;
  heroDecor: "grid" | "glow" | "none" | "blob";
  maxWidth: string;
};

const STYLES: Record<StyleKey, StylePreset> = {
  editorial: { radius: "4px", btnRadius: "2px", headingWeight: 400, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(40px, 7vw, 84px)", h2: "clamp(28px, 4.2vw, 48px)", sectionPad: "112px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1160px" },
  bold: { radius: "0px", btnRadius: "0px", headingWeight: 700, headingTransform: "uppercase", headingTracking: "-0.03em", h1: "clamp(48px, 9vw, 124px)", h2: "clamp(32px, 5.5vw, 64px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1200px" },
  tech: { radius: "14px", btnRadius: "10px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.03em", h1: "clamp(38px, 6vw, 72px)", h2: "clamp(26px, 3.8vw, 44px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "glow", maxWidth: "1140px" },
  clinico: { radius: "18px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.015em", h1: "clamp(34px, 5vw, 58px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "88px", cardBorder: false, cardShadow: true, heroDecor: "blob", maxWidth: "1120px" },
  calido: { radius: "24px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.015em", h1: "clamp(36px, 5.5vw, 64px)", h2: "clamp(26px, 3.6vw, 42px)", sectionPad: "96px", cardBorder: false, cardShadow: true, heroDecor: "blob", maxWidth: "1120px" },
  gourmet: { radius: "6px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.01em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 46px)", sectionPad: "104px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1160px" },
  producto: { radius: "20px", btnRadius: "999px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.025em", h1: "clamp(34px, 5vw, 60px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "80px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1180px" },
  tienda: { radius: "16px", btnRadius: "999px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.025em", h1: "clamp(38px, 6vw, 76px)", h2: "clamp(22px, 3vw, 32px)", sectionPad: "72px", cardBorder: false, cardShadow: false, heroDecor: "none", maxWidth: "1240px" },
  lanzamiento: { radius: "16px", btnRadius: "12px", headingWeight: 800, headingTransform: "none", headingTracking: "-0.03em", h1: "clamp(36px, 6vw, 70px)", h2: "clamp(26px, 3.8vw, 44px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "glow", maxWidth: "1120px" },
  corporativo: { radius: "8px", btnRadius: "6px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(34px, 5vw, 58px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "88px", cardBorder: true, cardShadow: false, heroDecor: "grid", maxWidth: "1160px" },
  pop: { radius: "28px", btnRadius: "999px", headingWeight: 800, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 46px)", sectionPad: "88px", cardBorder: true, cardShadow: true, heroDecor: "blob", maxWidth: "1140px" },
  lujo: { radius: "2px", btnRadius: "2px", headingWeight: 400, headingTransform: "none", headingTracking: "0.01em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 48px)", sectionPad: "120px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1120px" },
};

const ICONS: Record<string, string> = {
  truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19c3-3 6-5 9-7"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9C9 9 7 4 10 4s2 5 2 5 0-5 2-5 1 5-2 5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.5-3 3-5 6-5s5.5 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.5.2 4.2 1.8 4.7 4.5"/>',
  map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

function icon(name: string): string {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.check}</svg>`;
}

function fontLink(fonts: string[]): string {
  const families = fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type RenderV2Context = {
  businessName: string;
  trackingBasePath: string;
  preview?: boolean;
  leadSubmitted?: boolean;
  heroImageUrl?: string | null;
  photos?: string[];
  products?: CatalogProduct[];
};

export function renderWebsiteHtmlV2(content: WebsiteContentV2, ctx: RenderV2Context): string {
  const style = STYLES[content.style] ?? STYLES.editorial;
  const products = ctx.products ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const photos = (ctx.photos ?? []).map(safeUrl).filter((u): u is string => !!u);
  const heroImage = safeUrl(ctx.heroImageUrl) ?? photos[0] ?? null;

  const previewQ = ctx.preview ? "&preview=1" : "";
  const href = (label: string) => `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(label)}${previewQ}`;
  const orderHref = (p: CatalogProduct) =>
    `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(`pedido:${p.name}`.slice(0, 80))}&p=${encodeURIComponent(p.id)}${previewQ}`;
  const registroAction = `${ctx.trackingBasePath}/registro${ctx.preview ? "?preview=1" : ""}`;

  const primary = sanitizeHexColor(content.theme.primaryColor, "#1f6feb");
  const bg = sanitizeHexColor(content.theme.backgroundColor, "#fafaf7");
  const surface = sanitizeHexColor(content.theme.surfaceColor, "#f1f0eb");
  const textColor = sanitizeHexColor(content.theme.textColor, "#141414");
  const fonts = Array.from(new Set([content.theme.headingFont, content.theme.bodyFont]));
  const fontStack = (f: string) => `"${f}", ${SERIF_FONTS.has(f) ? "Georgia, serif" : "system-ui, sans-serif"}`;

  const hidden = new Set(content.hidden ?? []);
  const sections = content.sections.map((s, i) => ({ s, i })).filter(({ i }) => !hidden.has(i));

  const priceHtml = (p: CatalogProduct) => {
    if (p.price === null) return `<span class="price">Consultar precio</span>`;
    const compare =
      p.compareAtPrice && p.compareAtPrice > p.price
        ? `<span class="compare">${esc(formatMoney(p.compareAtPrice, p.currency))}</span><span class="off">-${Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>`
        : "";
    return `<span class="price">${esc(formatMoney(p.price, p.currency))}</span>${compare}`;
  };

  const productImage = (p: CatalogProduct, cls = "") => {
    const url = safeUrl(p.imageUrl);
    return url
      ? `<img class="${cls}" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy">`
      : `<div class="img-ph ${cls}" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</div>`;
  };

  const productCard = (p: CatalogProduct, featured = false) => `
    <article class="pcard${featured ? " pcard-featured" : ""}">
      <div class="pcard-media">
        ${p.badge ? `<span class="pbadge">${esc(p.badge)}</span>` : ""}
        ${productImage(p)}
      </div>
      <div class="pcard-body">
        ${p.category ? `<p class="pcat">${esc(p.category)}</p>` : ""}
        <h3>${esc(p.name)}</h3>
        ${featured && p.description ? `<p class="pdesc">${esc(p.description)}</p>` : ""}
        <div class="prow">${priceHtml(p)}</div>
        <a class="btn btn-sm" href="${esc(orderHref(p))}">Pedir por WhatsApp</a>
      </div>
    </article>`;

  const kickerHtml = (k: string | null | undefined) => (k ? `<p class="kicker">${esc(k)}</p>` : "");

  // Paints the AI-chosen words of the headline in the accent color.
  const headline = (heading: string, highlight: string | null | undefined) => {
    const h = highlight?.trim();
    const at = h ? heading.toLowerCase().indexOf(h.toLowerCase()) : -1;
    if (!h || at < 0) return esc(heading);
    return `${esc(heading.slice(0, at))}<span class="hl">${esc(heading.slice(at, at + h.length))}</span>${esc(heading.slice(at + h.length))}`;
  };

  const leadFormHtml = (buttonLabel: string) =>
    ctx.leadSubmitted
      ? `<p class="lead-ok">¡Listo! Recibimos tus datos y te escribimos muy pronto.</p>`
      : `<form class="lead-form" method="POST" action="${esc(registroAction)}">
          <input type="text" name="name" placeholder="Tu nombre" maxlength="120" required>
          <input type="text" name="contact" placeholder="Tu WhatsApp o teléfono" maxlength="120" required>
          <textarea name="message" placeholder="Cuéntanos qué necesitas (opcional)" rows="2" maxlength="500"></textarea>
          <button class="btn" type="submit">${esc(buttonLabel)}</button>
        </form>`;

  const renderSection = (s: Section, index: number): string => {
    switch (s.type) {
      case "hero": {
        const product = s.productId ? productById.get(s.productId) : undefined;
        const primaryBtn = `<a class="btn" href="${esc(href("hero"))}">${esc(s.ctaLabel)}</a>`;
        const secondaryBtn = s.secondaryCtaLabel
          ? `<a class="btn btn-ghost" href="#${products.length > 0 ? "productos" : "detalles"}">${esc(s.secondaryCtaLabel)}</a>`
          : "";
        const eyebrow = s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : "";
        const badge = s.badge ? `<span class="hero-badge">${esc(s.badge)}</span>` : "";
        const chips = (s.chips ?? []).slice(0, 3);
        const chipsHtml = chips.length ? `<ul class="chips">${chips.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
        const h1 = (cls = "") => `<h1${cls ? ` class="${cls}"` : ""}>${headline(s.heading, s.highlight)}</h1>`;

        // Event / lead-capture hero (refs: webinar pages): copy + chips on
        // one side, the registration form right there on the other.
        if (s.showLeadForm) {
          return `<section class="hero hero-form" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap hero-split-grid">
            <div>${eyebrow}${h1()}<p class="lead">${esc(s.subheading)}</p>${chipsHtml}${badge}</div>
            <div class="form-card">${heroImage ? `<img class="form-card-img" src="${esc(heroImage)}" alt="">` : ""}<p class="form-card-title">${esc(s.ctaLabel)}</p>${leadFormHtml(s.ctaLabel)}</div>
          </div></section>`;
        }

        if (s.variant === "product" && product) {
          return `<section class="hero hero-product" id="inicio"><div class="wrap hero-product-grid">
            <div class="hero-product-media">${product.badge ? `<span class="pbadge">${esc(product.badge)}</span>` : ""}${productImage(product, "hero-product-img")}</div>
            <div class="hero-product-info">
              ${eyebrow}
              ${h1()}
              <p class="lead">${esc(s.subheading)}</p>
              <div class="prow prow-lg">${priceHtml(product)}</div>
              ${chipsHtml}
              <div class="hero-actions"><a class="btn btn-block" href="${esc(orderHref(product))}">${esc(s.ctaLabel)}</a>${secondaryBtn}</div>
              ${badge}
            </div>
          </div></section>`;
        }
        if (s.variant === "fullbleed" && heroImage) {
          return `<section class="hero hero-full" id="inicio" style="background-image:linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.25)), url('${esc(heroImage)}')">
            <div class="wrap"><div class="hero-full-inner">${eyebrow}${h1()}<p class="lead">${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div></div>
          </section>`;
        }
        if (s.variant === "giant") {
          return `<section class="hero hero-giant" id="inicio"><div class="wrap">
            ${eyebrow}${h1("giant")}
            <div class="giant-row">
              ${heroImage ? `<img class="giant-img" src="${esc(heroImage)}" alt="">` : ""}
              <div class="giant-copy"><p class="lead">${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div>
            </div>
          </div></section>`;
        }
        if (s.variant === "split" && heroImage) {
          return `<section class="hero hero-split" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap hero-split-grid">
            <div>${eyebrow}${h1()}<p class="lead">${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div>
            <div class="hero-media"><img src="${esc(heroImage)}" alt=""></div>
          </div></section>`;
        }
        return `<section class="hero hero-centered" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap narrow">
          ${eyebrow}${h1()}<p class="lead">${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions center">${primaryBtn}${secondaryBtn}</div>${badge}
          ${heroImage && s.variant === "centered" ? `<img class="hero-wide" src="${esc(heroImage)}" alt="">` : ""}
        </div></section>`;
      }

      case "trustBar":
        return `<section class="trust"><div class="wrap trust-grid">${s.items
          .slice(0, 4)
          .map((it) => `<div class="trust-item">${icon(it.icon)}<div><p class="t-title">${esc(it.title)}</p><p class="t-desc">${esc(it.description)}</p></div></div>`)
          .join("")}</div></section>`;

      case "features":
        return `<section class="sec" id="${index === 1 ? "detalles" : `s${index}`}"><div class="wrap">
          ${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2>${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ""}
          <div class="feat feat-${s.variant}">${s.items
            .slice(0, 6)
            .map((it) => `<div class="feat-item">${s.variant !== "list" ? `<span class="feat-ico">${icon(it.icon)}</span>` : `<span class="feat-check">${icon("check")}</span>`}<div><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></div></div>`)
            .join("")}</div>
        </div></section>`;

      case "steps":
        return `<section class="sec alt" id="como-funciona"><div class="wrap">
          ${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2>
          <ol class="steps">${s.items
            .slice(0, 4)
            .map((it, i) => `<li><span class="step-n">${String(i + 1).padStart(2, "0")}</span><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></li>`)
            .join("")}</ol>
        </div></section>`;

      case "productGrid": {
        const chosen = (s.productIds.length > 0 ? s.productIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p) : products).slice(0, 48);
        if (chosen.length === 0) {
          return ctx.preview
            ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerán tus productos. Agrégalos en <strong>Productos</strong> dentro de la plataforma.</div></div></section>`
            : "";
        }
        const head = `${kickerHtml(s.kicker)}<div class="sec-head"><h2>${esc(s.heading)}</h2></div>`;
        if (s.showCategoryFilter) {
          const cats = Array.from(new Set(chosen.map((p) => p.category ?? "Otros")));
          if (cats.length > 1) {
            return `<section class="sec" id="productos"><div class="wrap">${head}
              <nav class="cat-tabs" aria-label="Categorías">${cats.map((c) => `<a href="#cat-${esc(slugify(c))}">${esc(c)}</a>`).join("")}</nav>
              ${cats
                .map(
                  (c) => `<div class="cat-group" id="cat-${esc(slugify(c))}"><h3 class="cat-title">${esc(c)}</h3><div class="pgrid">${chosen
                    .filter((p) => (p.category ?? "Otros") === c)
                    .map((p) => productCard(p))
                    .join("")}</div></div>`,
                )
                .join("")}
            </div></section>`;
          }
        }
        if (s.variant === "row") {
          return `<section class="sec" id="productos"><div class="wrap">${head}<div class="prow-scroll">${chosen.map((p) => productCard(p)).join("")}</div></div></section>`;
        }
        if (s.variant === "featured") {
          return `<section class="sec" id="productos"><div class="wrap">${head}<div class="pgrid pgrid-featured">${chosen.slice(0, 6).map((p) => productCard(p, true)).join("")}</div></div></section>`;
        }
        return `<section class="sec" id="productos"><div class="wrap">${head}<div class="pgrid">${chosen.map((p) => productCard(p)).join("")}</div></div></section>`;
      }

      case "productSpotlight": {
        const p = productById.get(s.productId) ?? products[0];
        if (!p) return "";
        const specs = s.specs.slice(0, 8);
        return `<section class="sec alt" id="producto"><div class="wrap spot">
          <div class="spot-media">${productImage(p, "spot-img")}</div>
          <div class="spot-info">
            <h2>${esc(s.heading)}</h2>
            <ul class="spot-bullets">${s.bullets.slice(0, 4).map((b) => `<li>${icon(b.icon)}<div><strong>${esc(b.title)}</strong><span>${esc(b.description)}</span></div></li>`).join("")}</ul>
            ${specs.length ? `<dl class="specs">${specs.map((sp) => `<div><dt>${esc(sp.label)}</dt><dd>${esc(sp.value)}</dd></div>`).join("")}</dl>` : ""}
            <div class="prow prow-lg">${priceHtml(p)}</div>
            <a class="btn" href="${esc(orderHref(p))}">Pedir por WhatsApp</a>
          </div>
        </div></section>`;
      }

      case "promo":
        return `<section class="promo promo-${s.tone}"><div class="wrap promo-inner">
          <div>${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></div>
          <a class="btn ${s.tone === "accent" ? "btn-invert" : ""}" href="${esc(href("promo"))}">${esc(s.ctaLabel)}</a>
        </div></section>`;

      case "comparison":
        return `<section class="sec"><div class="wrap narrow-lg">
          <h2>${esc(s.heading)}</h2>
          <div class="cmp-wrap"><table class="cmp"><thead><tr><th></th><th class="us">${esc(s.usLabel)}</th><th>${esc(s.othersLabel)}</th></tr></thead>
          <tbody>${s.rows.slice(0, 6).map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="us">${esc(r.us)}</td><td>${esc(r.others)}</td></tr>`).join("")}</tbody></table></div>
        </div></section>`;

      case "agenda":
        return `<section class="sec alt" id="agenda"><div class="wrap">
          ${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2>
          <div class="agenda">${s.items
            .slice(0, 6)
            .map((it, i) => `<article class="ag-item"><div class="ag-num">${String(i + 1).padStart(2, "0")}</div><div><p class="ag-when">${esc(it.when)}</p><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></div></article>`)
            .join("")}</div>
          <div class="center mt"><a class="btn" href="${esc(href("agenda"))}">Quiero participar</a></div>
        </div></section>`;

      case "host":
        return `<section class="sec" id="nosotros"><div class="wrap host${heroImage ? "" : " host-noimg"}">
          ${heroImage ? `<img class="host-img" src="${esc(photos[1] ?? heroImage)}" alt="">` : ""}
          <div>${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2><p class="host-name">${esc(s.name)}${s.role ? ` <span>· ${esc(s.role)}</span>` : ""}</p><p class="host-body">${esc(s.body)}</p></div>
        </div></section>`;

      case "objections":
        return `<section class="sec" id="preguntas"><div class="wrap narrow-lg">
          ${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2>
          <div class="faq">${s.items
            .slice(0, 6)
            .map((o, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(o.question)}<span class="faq-plus" aria-hidden="true">+</span></summary><p>${esc(o.answer)}</p></details>`)
            .join("")}</div>
        </div></section>`;

      case "stats":
        return `<section class="stats"><div class="wrap stats-grid">${s.items
          .slice(0, 4)
          .map((it) => `<div><p class="stat-v">${esc(it.value)}</p><p class="stat-l">${esc(it.label)}</p></div>`)
          .join("")}</div></section>`;

      case "gallery":
        if (photos.length === 0) return "";
        return `<section class="sec"><div class="wrap">${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2>
          <div class="gallery">${photos.slice(0, 8).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div></div></section>`;

      case "leadForm":
        return `<section class="sec alt" id="registro"><div class="wrap narrow">
          ${kickerHtml(s.kicker)}<h2>${esc(s.heading)}</h2><p class="intro">${esc(s.body)}</p>
          ${leadFormHtml(s.buttonLabel)}
        </div></section>`;

      case "cta":
        return `<section class="final-cta"><div class="wrap narrow center">
          <h2>${esc(s.heading)}</h2><p class="intro">${esc(s.body)}</p>
          <a class="btn btn-lg" href="${esc(href("cta-final"))}">${esc(s.ctaLabel)}</a>
        </div></section>`;
    }
  };

  const body = sections.map(({ s, i }) => renderSection(s, i)).join("\n");
  const firstHero = content.sections.find((s) => s.type === "hero");
  const navLinks: { href: string; label: string }[] = [];
  if (sections.some(({ s }) => s.type === "productGrid") && products.length > 0) navLinks.push({ href: "#productos", label: "Productos" });
  if (sections.some(({ s }) => s.type === "agenda")) navLinks.push({ href: "#agenda", label: "Agenda" });
  if (sections.some(({ s }) => s.type === "steps")) navLinks.push({ href: "#como-funciona", label: "Cómo funciona" });
  if (sections.some(({ s }) => s.type === "objections")) navLinks.push({ href: "#preguntas", label: "Preguntas" });
  const isShop = content.pageType === "producto" || content.pageType === "tienda";

  const decor =
    style.heroDecor === "grid"
      ? `background-image: linear-gradient(color-mix(in srgb, var(--text) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text) 8%, transparent) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(ellipse at top, #000 30%, transparent 75%);`
      : style.heroDecor === "glow"
        ? `background: radial-gradient(50% 60% at 70% 20%, color-mix(in srgb, var(--primary) 35%, transparent), transparent 70%);`
        : style.heroDecor === "blob"
          ? `background: radial-gradient(40% 50% at 85% 30%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 70%), radial-gradient(30% 40% at 10% 90%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%);`
          : "display:none;";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.businessName)}${firstHero && firstHero.type === "hero" ? ` · ${esc(firstHero.heading)}` : ""}</title>
<meta name="description" content="${esc(firstHero && firstHero.type === "hero" ? firstHero.subheading : ctx.businessName)}">
${fontLink(fonts)}
<style>
:root{--primary:${primary};--btn-text:${readableTextColor(primary)};--bg:${bg};--surface:${surface};--text:${textColor};
--muted:color-mix(in srgb,var(--text) 64%,transparent);--line:color-mix(in srgb,var(--text) 12%,transparent);
--hf:${fontStack(content.theme.headingFont)};--bf:${fontStack(content.theme.bodyFont)};
--r:${style.radius};--br:${style.btnRadius};--pad:${style.sectionPad};--max:${style.maxWidth}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--bf);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--hf);font-weight:${style.headingWeight};letter-spacing:${style.headingTracking};text-transform:${style.headingTransform};line-height:1.06;margin:0 0 .5em;text-wrap:balance}
h1{font-size:${style.h1}}
h2{font-size:${style.h2};line-height:1.1}
h3{font-size:19px;line-height:1.25;letter-spacing:-.01em;text-transform:none}
p{margin:0 0 1em}
a{color:inherit}
a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
.narrow{max-width:760px}.narrow-lg{max-width:900px}
.center{text-align:center}.mt{margin-top:32px}
.kicker,.eyebrow{font-family:var(--bf);font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--primary);margin:0 0 14px}
.intro,.lead{color:var(--muted);font-size:19px;max-width:60ch}
.center .intro,.center .lead{margin-inline:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:var(--btn-text);border:1px solid var(--primary);padding:15px 30px;border-radius:var(--br);text-decoration:none;font-weight:700;font-family:var(--bf);font-size:16px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px -10px color-mix(in srgb,var(--primary) 70%,transparent)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--line)}
.btn-ghost:hover{border-color:var(--text);box-shadow:none}
.btn-sm{padding:10px 16px;font-size:14px;width:100%}
.btn-lg{padding:18px 38px;font-size:18px}
.btn-block{width:100%}
.btn-invert{background:var(--btn-text);color:var(--primary);border-color:var(--btn-text)}
.annc{background:var(--text);color:var(--bg);text-align:center;font-size:14px;font-weight:600;padding:9px 16px}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:24px;height:68px}
.brand{font-family:var(--hf);font-weight:700;font-size:20px;letter-spacing:-.02em;text-decoration:none;text-transform:none}
.nav{display:flex;gap:22px;margin-left:auto;font-size:15px}
.nav a{text-decoration:none;color:var(--muted)}
.nav a:hover{color:var(--text)}
header.top .btn{padding:10px 18px;font-size:14px}
section{position:relative}
.sec{padding:var(--pad) 0}
.sec.alt,.trust{background:var(--surface)}
.sec-head{display:flex;align-items:end;justify-content:space-between;gap:16px}
.hero{padding:calc(var(--pad) * .9) 0 var(--pad);overflow:hidden}
.hero .decor{position:absolute;inset:0;pointer-events:none;${decor}}
.hero .wrap{position:relative}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.hero-actions.center{justify-content:center}
.hero-badge{display:inline-block;margin-top:22px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font-weight:700;font-size:14px;padding:7px 14px;border-radius:999px}
.hl{color:var(--primary)}
.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:22px 0 0}
.chips li{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.hero-centered .chips{justify-content:center}
.form-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:28px;box-shadow:0 30px 60px -36px color-mix(in srgb,var(--text) 50%,transparent)}
.form-card-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:calc(var(--r) * .7);margin-bottom:18px}
.form-card-title{font-family:var(--hf);font-weight:700;font-size:22px;margin:0}
.form-card .lead-form{margin-top:14px}
.hero-centered{text-align:center}
.hero-centered .lead{margin-inline:auto}
.hero-wide{margin-top:56px;border-radius:var(--r);width:100%;max-height:560px;object-fit:cover}
.hero-split-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:center}
.hero-media img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--r);${style.cardShadow ? "box-shadow:0 30px 60px -30px color-mix(in srgb,var(--text) 45%,transparent);" : ""}}
.hero-full{min-height:min(88vh,760px);display:flex;align-items:center;background-size:cover;background-position:center;color:#fff}
.hero-full .lead{color:rgba(255,255,255,.85)}
.hero-full-inner{max-width:640px}
.hero-full .btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}
.giant{font-size:clamp(64px,15vw,220px)!important;line-height:.88;margin-bottom:.25em}
.giant-row{display:grid;grid-template-columns:1.4fr 1fr;gap:40px;align-items:end}
.giant-img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:var(--r)}
.hero-product-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}
.hero-product-media{position:relative;background:var(--surface);border-radius:var(--r);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hero-product-img{width:86%;height:86%;object-fit:contain}
.prow{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin:6px 0 14px}
.price{font-weight:700;font-size:18px}
.prow-lg .price{font-size:34px;color:var(--primary);font-family:var(--hf)}
.compare{text-decoration:line-through;color:var(--muted);font-size:15px}
.off{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary);font-size:13px;font-weight:700;padding:3px 8px;border-radius:999px}
.trust{padding:30px 0;border-block:1px solid var(--line)}
.trust-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.trust-item{display:flex;gap:14px;align-items:flex-start}
.trust-item .ico{width:30px;height:30px;flex:none;color:var(--primary)}
.t-title{font-weight:700;margin:0;font-size:15px}
.t-desc{margin:0;color:var(--muted);font-size:14px}
.feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;margin-top:40px}
.feat-item{display:flex;flex-direction:column;gap:14px}
.feat-cards .feat-item{padding:30px;border-radius:var(--r);background:var(--surface);${style.cardBorder ? "border:1px solid var(--line);" : ""}${style.cardShadow ? "box-shadow:0 16px 40px -28px color-mix(in srgb,var(--text) 40%,transparent);" : ""}}
.feat-list{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.feat-list .feat-item{flex-direction:row;padding:18px 0;border-bottom:1px solid var(--line)}
.feat-ico{width:52px;height:52px;border-radius:calc(var(--r) * .7 + 6px);background:color-mix(in srgb,var(--primary) 13%,transparent);color:var(--primary);display:flex;align-items:center;justify-content:center}
.feat-ico .ico{width:26px;height:26px}
.feat-check .ico{width:24px;height:24px;color:var(--primary);flex:none}
.feat-item h3{margin-bottom:6px}
.feat-item p{margin:0;color:var(--muted);font-size:16px}
.steps{list-style:none;padding:0;margin:44px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;counter-reset:s}
.steps li{border-top:2px solid var(--text);padding-top:20px}
.step-n{display:block;font-family:var(--hf);font-size:44px;font-weight:700;color:var(--primary);line-height:1;margin-bottom:14px}
.steps p{color:var(--muted);margin:0}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px;margin-top:28px}
.pgrid-featured{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.prow-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px;margin-top:28px}
.prow-scroll>*{scroll-snap-align:start}
.pcard{display:flex;flex-direction:column;border-radius:var(--r);${style.cardBorder ? "border:1px solid var(--line);" : ""}background:var(--bg);overflow:hidden;transition:transform .2s ease,box-shadow .2s ease}
.pcard:hover{transform:translateY(-3px);box-shadow:0 22px 40px -28px color-mix(in srgb,var(--text) 55%,transparent)}
.pcard-media{position:relative;aspect-ratio:1/1;background:var(--surface);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:${style.cardBorder ? "0" : "var(--r)"}}
.pcard-media img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}
.pcard:hover .pcard-media img{transform:scale(1.04)}
.img-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--hf);font-size:64px;color:color-mix(in srgb,var(--text) 22%,transparent)}
.pbadge{position:absolute;top:12px;left:12px;z-index:1;background:var(--text);color:var(--bg);font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px}
.pcard-body{padding:16px 16px 18px;display:flex;flex-direction:column;flex:1}
.pcard-body h3{font-size:17px;margin:0 0 4px}
.pcard-body .btn{margin-top:auto}
.pcat{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 4px}
.pdesc{color:var(--muted);font-size:15px;margin:0 0 8px}
.cat-tabs{display:flex;gap:10px;overflow-x:auto;margin-top:24px;padding-bottom:6px}
.cat-tabs a{flex:none;text-decoration:none;font-weight:600;font-size:15px;padding:9px 18px;border-radius:999px;border:1px solid var(--line)}
.cat-tabs a:hover{background:var(--text);color:var(--bg)}
.cat-group{scroll-margin-top:90px;margin-top:40px}
.cat-title{font-size:22px}
.spot{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.spot-media{background:var(--bg);border-radius:var(--r);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden}
.spot-img{width:100%;height:100%;object-fit:cover}
.spot-bullets{list-style:none;padding:0;margin:20px 0;display:grid;gap:16px}
.spot-bullets li{display:flex;gap:14px}
.spot-bullets .ico{width:26px;height:26px;color:var(--primary);flex:none}
.spot-bullets strong{display:block}
.spot-bullets span{color:var(--muted);font-size:15px}
.specs{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0 0 20px;border-top:1px solid var(--line)}
.specs div{padding:10px 0;border-bottom:1px solid var(--line)}
.specs dt{font-size:13px;color:var(--muted)}
.specs dd{margin:0;font-weight:600}
.promo{padding:calc(var(--pad) * .65) 0}
.promo-dark{background:var(--text);color:var(--bg)}
.promo-dark .kicker{color:var(--primary)}
.promo-dark .btn{background:var(--bg);color:var(--text);border-color:var(--bg)}
.promo-accent{background:var(--primary);color:var(--btn-text)}
.promo-accent .kicker{color:var(--btn-text);opacity:.8}
.promo-soft{background:color-mix(in srgb,var(--primary) 12%,var(--bg))}
.promo-inner{display:flex;align-items:center;justify-content:space-between;gap:32px}
.promo h2{margin-bottom:.25em}
.promo p{margin:0;opacity:.8;max-width:56ch}
.cmp-wrap{overflow-x:auto;margin-top:32px}
.cmp{width:100%;border-collapse:collapse;font-size:16px}
.cmp th,.cmp td{padding:16px;border-bottom:1px solid var(--line);text-align:left}
.cmp thead th{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.cmp .us{background:color-mix(in srgb,var(--primary) 9%,transparent);font-weight:600}
.cmp thead .us{color:var(--primary)}
.agenda{display:grid;gap:18px;margin-top:36px}
.ag-item{display:grid;grid-template-columns:auto 1fr;gap:24px;padding:26px;border-radius:var(--r);background:var(--bg);border:1px solid var(--line)}
.ag-num{font-family:var(--hf);font-size:46px;font-weight:700;line-height:1;color:var(--primary)}
.ag-when{font-size:14px;font-weight:700;color:var(--primary);margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em}
.ag-item p{color:var(--muted);margin:0}
.host{display:grid;grid-template-columns:.9fr 1.1fr;gap:56px;align-items:center}
.host-noimg{grid-template-columns:1fr}
.host-img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--r)}
.host-name{font-weight:700;font-size:18px}
.host-name span{font-weight:400;color:var(--muted)}
.host-body{color:var(--muted);white-space:pre-line}
.faq{margin-top:28px;border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;padding:22px 0;font-weight:700;font-size:18px}
.faq summary::-webkit-details-marker{display:none}
.faq-plus{font-size:24px;line-height:1;color:var(--primary);transition:transform .2s ease}
.faq details[open] .faq-plus{transform:rotate(45deg)}
.faq details p{color:var(--muted);margin:0 0 22px;max-width:70ch}
.stats{padding:56px 0;border-block:1px solid var(--line)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;text-align:center}
.stat-v{font-family:var(--hf);font-size:clamp(36px,5vw,56px);font-weight:700;margin:0;color:var(--primary)}
.stat-l{margin:0;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:28px}
.gallery img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--r)}
.lead-form{display:grid;gap:12px;margin-top:24px}
.lead-form input,.lead-form textarea{font:inherit;padding:15px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
.lead-ok{padding:18px;border-radius:12px;background:color-mix(in srgb,var(--primary) 14%,transparent);font-weight:600}
.final-cta{padding:var(--pad) 0;background:var(--surface)}
.empty-note{padding:28px;border:2px dashed var(--line);border-radius:var(--r);text-align:center;color:var(--muted)}
footer.foot{padding:40px 0;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
footer.foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
.ico{width:22px;height:22px}
.mbar{display:none}
@media (max-width:860px){
  body{font-size:16px}
  .nav{display:none}
  header.top .wrap{height:60px;gap:12px}
  .brand{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
  header.top .btn{padding:8px 14px;font-size:13px;white-space:nowrap;margin-left:auto}
  .hero-split-grid,.hero-product-grid,.giant-row,.spot,.host{grid-template-columns:1fr;gap:32px}
  .hero-media img{aspect-ratio:4/3}
  .trust-grid{grid-template-columns:1fr 1fr}
  .promo-inner{flex-direction:column;align-items:flex-start}
  .pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .pcard-body{padding:12px}
  .btn-sm{padding:9px 10px;font-size:13px}
  .ag-item{grid-template-columns:1fr;gap:8px}
  .specs{grid-template-columns:1fr}
  ${isShop ? ".mbar{display:block;position:sticky;bottom:0;z-index:30;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--line)} .mbar .btn{width:100%}" : ""}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body class="st-${content.style} pt-${content.pageType}">
${content.announcement ? `<div class="annc">${esc(content.announcement)}</div>` : ""}
<header class="top"><div class="wrap">
  <a class="brand" href="#inicio">${esc(ctx.businessName)}</a>
  <nav class="nav" aria-label="Secciones">${navLinks.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("")}</nav>
  <a class="btn" href="${esc(href("header"))}">${isShop ? "Pedir por WhatsApp" : "Escríbenos"}</a>
</div></header>
<main>
${body}
</main>
<footer class="foot"><div class="wrap"><span>© ${esc(ctx.businessName)}</span><a href="${esc(href("footer"))}">Escríbenos por WhatsApp</a></div></footer>
${isShop ? `<div class="mbar"><a class="btn" href="${esc(href("barra-movil"))}">Pedir por WhatsApp</a></div>` : ""}
</body>
</html>`;
}
