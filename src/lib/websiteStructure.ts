import type { CatalogProduct, Section, WebsiteContentV2 } from "@/lib/websiteContentV2";

// What every generated page must have, enforced in code instead of trusting the AI to
// remember it: the scrolling top bar, a promotion banner, and (on showroom and
// brand-story pages with a catalog) the interactive centerpiece and the quoter. Only
// real material already on the page or in the catalog is reused; nothing is invented.

const hasPhoto = (p: CatalogProduct) => !!p.imageUrl;
const hasPrice = (p: CatalogProduct) => p.price !== null && p.price > 0;
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function ensureStructure(content: WebsiteContentV2, products: CatalogProduct[]): WebsiteContentV2 {
  const sections: Section[] = [...content.sections];
  let announcement = content.announcement;

  // 1. The top bar: phrases the page already says (guarantees, then benefits).
  if (!announcement || !announcement.trim()) {
    const trust = sections.find((s) => s.type === "trustBar");
    const feats = sections.find((s) => s.type === "features");
    const titles = trust && trust.type === "trustBar" ? trust.items.map((i) => i.title) : feats && feats.type === "features" ? feats.items.map((i) => i.title) : [];
    const phrases = titles.map((t) => t.trim()).filter(Boolean).slice(0, 4);
    announcement = phrases.length >= 2 ? phrases.join(" · ") : null;
  }

  const heroAt = sections.findIndex((s) => s.type === "hero");
  const after = (at: number) => Math.max(at, heroAt) + 1;
  const photos = products.filter(hasPhoto);
  const priced = products.filter(hasPrice);

  // 2. The interactive centerpiece for product-led page types.
  const hasCenterpiece = sections.some((s) => s.type === "showroom" || s.type === "fan" || s.type === "traveler");
  if (!hasCenterpiece && photos.length >= 1) {
    const feats = sections.find((s) => s.type === "features");
    const trust = sections.find((s) => s.type === "trustBar");
    if (content.pageType === "showroom") {
      const bubbles = feats && feats.type === "features" ? feats.items.slice(0, 3).map((i) => ({ title: clip(i.title, 40), description: clip(i.description, 70) })) : [];
      const facts = trust && trust.type === "trustBar" ? trust.items.slice(0, 3).map((i) => ({ title: clip(i.title, 30), description: clip(i.description, 50) })) : [];
      sections.splice(after(0), 0, { type: "showroom", kicker: "Míralo de cerca", heading: "Gíralo, compáralo, elígelo", productIds: [], bubbles, facts });
    } else if (content.pageType === "historia" && photos.length >= 2) {
      const at = sections.findIndex((s) => s.type === "features");
      sections.splice(after(at >= 0 ? at : 0), 0, { type: "fan", kicker: "La colección", heading: "Elige tu favorito", intro: "Arrastra para ver todos.", productIds: [] });
    }
  }

  // 3. The budget quoter on showroom pages (it needs two products with a price).
  if (content.pageType === "showroom" && priced.length >= 2 && !sections.some((s) => s.type === "quoter")) {
    const last = sections.length - 1;
    const closing = last > 0 && (sections[last].type === "leadForm" || sections[last].type === "cta") ? last : sections.length;
    sections.splice(closing, 0, { type: "quoter", kicker: "Cotizador", heading: "Mira qué te alcanza", intro: "Mueve la barra con tu presupuesto.", productIds: [], months: 48, note: null });
  }

  // 4. A promotion banner, built from the page's own closing invitation (never an invented offer: no countdown, no seal).
  if (!sections.some((s) => s.type === "promo")) {
    const closing = [...sections].reverse().find((s) => s.type === "cta" || s.type === "leadForm");
    if (closing && (closing.type === "cta" || closing.type === "leadForm")) {
      const label = closing.type === "cta" ? closing.ctaLabel : closing.buttonLabel;
      const at = Math.min(sections.length, Math.max(after(0) + 2, 3));
      sections.splice(at, 0, { type: "promo", tone: "soft", kicker: "Este mes", heading: clip(closing.heading, 70), body: clip(closing.body, 160), ctaLabel: clip(label, 30) });
    }
  }

  return { ...content, announcement, sections };
}
