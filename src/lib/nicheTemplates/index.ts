import { STYLE_THEME } from "@/lib/websiteStylePreview";
import type { Section, StyleKey, WebsiteContentV2 } from "@/lib/websiteContentV2";
import { BLUEPRINTS } from "./blueprints";
import type { Niche } from "./types";
import { FUNNELS, FUNNEL_NICHE, buildFunnelContent, getFunnelTemplate } from "./funnels";
import { abogados } from "./niches/abogados";
import { contadores } from "./niches/contadores";
import { esteticas } from "./niches/esteticas";
import { gimnasios } from "./niches/gimnasios";
import { inmobiliarias } from "./niches/inmobiliarias";
import { odontologos } from "./niches/odontologos";
import { psicologos } from "./niches/psicologos";
import { veterinarias } from "./niches/veterinarias";

// Ready-made landing pages by kind of business: NICHES × BLUEPRINTS. The owner browses them in the
// library, previews one and publishes it; it is created at once (no AI, no cost) with the
// business's name and brand color, and then edited in the builder like any other page.
//
// The copy only makes promises any business of the niche can keep and never invents prices,
// results, years of experience or numbers: whatever is specific to the business is for the owner
// to add. Which arrangement actually sells best is not decided here: each page records the template
// it came from (Website.model = "template:<id>"), so views, clicks and contacts can be compared.

export const NICHES: Niche[] = [contadores, esteticas, odontologos, abogados, psicologos, veterinarias, gimnasios, inmobiliarias];

export const TEMPLATES_PER_NICHE = BLUEPRINTS.length;

/** Everything the library needs to draw a card; plain data, safe to send to the browser. */
export type TemplateCard = {
  id: string;
  nicheId: string;
  nicheName: string;
  nicheShort: string;
  emoji: string;
  /** 1..12 within the niche. */
  number: number;
  name: string;
  strategy: string;
  shape: { type: Section["type"]; variant?: string }[];
  style: StyleKey;
  dark: boolean;
  colors: { primary: string; bg: string; surface: string; text: string };
  headingFont: string;
  heroVariant: "split" | "centered" | "giant" | "wordmark";
  heroForm: boolean;
  eyebrow: string;
  heading: string;
  highlight: string;
  cta: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const idOf = (nicheId: string, index: number) => `${nicheId}-${pad(index + 1)}`;

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
};

export function listTemplateCards(): TemplateCard[] {
  const cards: TemplateCard[] = [];
  for (const niche of NICHES) {
    BLUEPRINTS.forEach((bp, i) => {
      const style = niche.styleOrder[i];
      const theme = STYLE_THEME[style];
      const angle = niche.angles[i];
      const built = bp.build(niche, angle, "Tu negocio");
      const hero = built[0];
      cards.push({
        id: idOf(niche.id, i),
        nicheId: niche.id,
        nicheName: niche.name,
        nicheShort: niche.short,
        emoji: niche.emoji,
        number: i + 1,
        name: bp.name,
        strategy: bp.strategy,
        shape: built.map((sec) => ({ type: sec.type, variant: "variant" in sec && typeof sec.variant === "string" ? sec.variant : undefined })),
        style,
        dark: isDark(theme.backgroundColor),
        colors: { primary: theme.primaryColor, bg: theme.backgroundColor, surface: theme.surfaceColor, text: theme.textColor },
        headingFont: theme.headingFont,
        heroVariant: hero.type === "hero" && (hero.variant === "centered" || hero.variant === "giant" || hero.variant === "wordmark") ? hero.variant : "split",
        heroForm: hero.type === "hero" ? hero.showLeadForm : false,
        eyebrow: angle.eyebrow.replaceAll("{negocio}", "Tu negocio"),
        heading: angle.heading,
        highlight: angle.highlight,
        cta: angle.cta,
      });
    });
  }
  return cards;
}

function parseId(id: string): { niche: Niche; index: number } | null {
  const m = /^([a-z]+)-(\d{2})$/.exec(id);
  if (!m) return null;
  const niche = NICHES.find((n) => n.id === m[1]);
  const index = Number(m[2]) - 1;
  return niche && index >= 0 && index < BLUEPRINTS.length ? { niche, index } : null;
}

export function getNicheTemplate(id: string): { id: string; niche: Niche; index: number; name: string } | null {
  const found = parseId(id);
  return found ? { id, niche: found.niche, index: found.index, name: found.niche.name } : null;
}

/** The page content for a template, with the business's name and brand color. */
export function buildNicheContent(
  template: { niche: Niche; index: number },
  opts: { businessName: string; brandColor?: string | null },
): WebsiteContentV2 {
  const { niche, index } = template;
  const style = niche.styleOrder[index];
  const sections = BLUEPRINTS[index].build(niche, niche.angles[index], opts.businessName);
  const accent = opts.brandColor && /^#[0-9a-fA-F]{6}$/.test(opts.brandColor) ? opts.brandColor : STYLE_THEME[style].primaryColor;
  return {
    version: 2,
    pageType: "captacion",
    style,
    announcement: null,
    theme: { ...STYLE_THEME[style], primaryColor: accent } as WebsiteContentV2["theme"],
    sections,
    hidden: [],
    ...(BLUEPRINTS[index].counters ? { counters: true } : {}),
    heroCtaUrl: null,
  };
}

/** A page with nothing on it: the owner builds it block by block (or pastes their own HTML). */
export function buildBlankContent(opts: { businessName: string; brandColor?: string | null }): WebsiteContentV2 {
  const style = "editorial" as const;
  const accent = opts.brandColor && /^#[0-9a-fA-F]{6}$/.test(opts.brandColor) ? opts.brandColor : STYLE_THEME[style].primaryColor;
  return {
    version: 2,
    pageType: "captacion",
    style,
    announcement: null,
    theme: { ...STYLE_THEME[style], primaryColor: accent } as WebsiteContentV2["theme"],
    sections: [
      { type: "hero", variant: "blank", eyebrow: null, heading: opts.businessName.slice(0, 70) || "Mi página", highlight: null, subheading: "", chips: [], showLeadForm: false, ctaLabel: "Escríbenos", secondaryCtaLabel: null, badge: null, productId: null },
    ],
    hidden: [],
    heroCtaUrl: null,
  };
}

/** The funnel templates as library cards (the first group of the library). */
export function listFunnelCards(): TemplateCard[] {
  return FUNNELS.map((f, i) => {
    const sections = f.build("Tu negocio");
    const hero = sections[0];
    const theme = STYLE_THEME[f.style];
    return {
      id: f.id,
      nicheId: FUNNEL_NICHE.id,
      nicheName: FUNNEL_NICHE.name,
      nicheShort: FUNNEL_NICHE.short,
      emoji: FUNNEL_NICHE.emoji,
      number: i + 1,
      name: f.name,
      strategy: f.strategy,
      shape: sections.map((sec) => ({ type: sec.type, variant: "variant" in sec && typeof sec.variant === "string" ? sec.variant : undefined })),
      style: f.style,
      dark: isDark(theme.backgroundColor),
      colors: { primary: theme.primaryColor, bg: theme.backgroundColor, surface: theme.surfaceColor, text: theme.textColor },
      headingFont: theme.headingFont,
      heroVariant: hero.type === "hero" && (hero.variant === "split" || hero.variant === "giant" || hero.variant === "wordmark") ? hero.variant : "centered",
      heroForm: hero.type === "hero" ? hero.showLeadForm : false,
      eyebrow: hero.type === "hero" ? (hero.eyebrow ?? "") : "",
      heading: hero.type === "hero" ? hero.heading : "",
      highlight: hero.type === "hero" ? (hero.highlight ?? "") : "",
      cta: hero.type === "hero" ? hero.ctaLabel : "",
    };
  });
}

export { buildFunnelContent, getFunnelTemplate };

/** A page that is only the owner's own HTML ("Subir mi HTML"): our header and sections are left out. */
export function buildHtmlPageContent(opts: { businessName: string; brandColor?: string | null; html: string; title?: string }): WebsiteContentV2 {
  const base = buildBlankContent(opts);
  const first = base.sections[0];
  if (first.type === "hero" && opts.title) first.heading = opts.title.slice(0, 70);
  return { ...base, fullHtml: true, sections: [first, { type: "html", code: opts.html, height: 0 }] };
}
