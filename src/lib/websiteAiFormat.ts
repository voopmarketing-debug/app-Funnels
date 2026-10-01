import { z } from "zod";
import {
  ICON_KEYS,
  PAGE_TYPES,
  STYLE_KEYS,
  SectionSchema,
  ThemeSchema,
  type AiWebsiteV2,
  type Section,
} from "@/lib/websiteContentV2";

/**
 * The format the AI fills in for a v2 page. The stored format
 * (websiteContentV2.ts) is a discriminated union of 15 section types, and
 * handing that union to structured outputs fails in production with
 * "The compiled grammar is too large". So the AI gets ONE flat section shape
 * (type + a shared set of fields) and fromAiSection maps it back to the
 * typed section, validated by SectionSchema. Field names match the ones the
 * generation prompt already talks about (variant, showLeadForm, productIds…).
 */

const AiItem = z.object({
  icon: z.enum(ICON_KEYS).nullable().catch(null),
  title: z.string().describe("Título del ítem. comparison: el aspecto comparado. objections: la pregunta. stats: la cifra. agenda: el nombre de la sesión."),
  text: z.string().describe("Descripción. comparison: lo nuestro. objections: la respuesta. stats: qué mide la cifra. agenda: de qué trata."),
  extra: z.string().nullable().catch(null).describe("comparison: lo de los otros. agenda: fecha/hora. Para el resto null."),
});

export const AiSectionSchema = z.object({
  type: z.enum([
    "hero",
    "trustBar",
    "features",
    "steps",
    "productGrid",
    "productSpotlight",
    "promo",
    "comparison",
    "agenda",
    "host",
    "objections",
    "stats",
    "gallery",
    "leadForm",
    "cta",
  ]),
  variant: z
    .string()
    .nullable()
    .catch(null)
    .describe("hero: split | centered | fullbleed | product | giant. features: cards | icons | list. productGrid: grid | row | featured. Resto: null."),
  tone: z.enum(["dark", "accent", "soft"]).nullable().catch(null).describe("Solo promo."),
  kicker: z.string().nullable().catch(null).describe("Etiqueta pequeña sobre el título (en hero es la etiqueta sobre el titular). null si no aplica."),
  heading: z.string().describe("Título de la sección. En stats y trustBar puede ir vacío."),
  highlight: z.string().nullable().catch(null).describe("Solo hero: 1 a 4 palabras EXACTAS del heading para resaltar."),
  body: z
    .string()
    .nullable()
    .catch(null)
    .describe("hero: subtítulo. features: intro opcional. promo, host, leadForm, cta: el texto de la sección."),
  ctaLabel: z.string().nullable().catch(null).describe("Texto del botón (hero, promo, cta, leadForm). Empieza con verbo."),
  secondaryCtaLabel: z.string().nullable().catch(null).describe("Solo hero: botón secundario opcional."),
  badge: z.string().nullable().catch(null).describe("Solo hero: sello SOLO si es un dato real."),
  chips: z.array(z.string()).catch([]).describe("Solo hero: datos clave reales (fecha, hora, modalidad). Máx. 3."),
  showLeadForm: z.boolean().nullable().catch(null).describe("Solo hero: true para poner el formulario en la portada."),
  showCategoryFilter: z.boolean().nullable().catch(null).describe("Solo productGrid: true para pestañas de categorías."),
  productId: z.string().nullable().catch(null).describe("hero variant product y productSpotlight: id de PRODUCTOS."),
  productIds: z.array(z.string()).catch([]).describe("Solo productGrid: ids en orden. Vacío = todos."),
  name: z.string().nullable().catch(null).describe("Solo host: nombre de la persona."),
  role: z.string().nullable().catch(null).describe("Solo host: cargo o especialidad."),
  usLabel: z.string().nullable().catch(null).describe("Solo comparison: columna propia."),
  othersLabel: z.string().nullable().catch(null).describe("Solo comparison: columna de comparación."),
  items: z
    .array(AiItem)
    .catch([])
    .describe("Ítems de trustBar, features, steps, comparison (filas), agenda, objections, stats y los bullets de productSpotlight."),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).catch([]).describe("Solo productSpotlight: especificaciones reales."),
});
export type AiSection = z.infer<typeof AiSectionSchema>;

export const AiPageSchema = z.object({
  pageType: z.enum(PAGE_TYPES).catch("servicios"),
  style: z.enum(STYLE_KEYS).catch("editorial"),
  announcement: z.string().nullable().catch(null).describe("Barra superior corta SOLO con un dato real. null si no hay."),
  theme: ThemeSchema,
  sections: z.array(AiSectionSchema).describe("Secciones en orden. La primera siempre es 'hero'."),
});
export type AiPage = z.infer<typeof AiPageSchema>;

const items = (s: AiSection) => s.items.map((i) => ({ title: i.title, description: i.text, icon: i.icon ?? "check" }));

function toTyped(s: AiSection): unknown {
  switch (s.type) {
    case "hero":
      return {
        type: "hero",
        variant: s.variant,
        eyebrow: s.kicker,
        heading: s.heading,
        highlight: s.highlight,
        subheading: s.body ?? "",
        chips: s.chips,
        showLeadForm: s.showLeadForm ?? false,
        ctaLabel: s.ctaLabel ?? "Escríbenos",
        secondaryCtaLabel: s.secondaryCtaLabel,
        badge: s.badge,
        productId: s.productId,
      };
    case "trustBar":
      return { type: "trustBar", items: items(s) };
    case "features":
      return { type: "features", variant: s.variant, kicker: s.kicker, heading: s.heading, intro: s.body, items: items(s) };
    case "steps":
      return { type: "steps", kicker: s.kicker, heading: s.heading, items: s.items.map((i) => ({ title: i.title, description: i.text })) };
    case "productGrid":
      return { type: "productGrid", variant: s.variant, kicker: s.kicker, heading: s.heading, productIds: s.productIds, showCategoryFilter: s.showCategoryFilter ?? false };
    case "productSpotlight":
      return { type: "productSpotlight", productId: s.productId ?? "", heading: s.heading, bullets: items(s), specs: s.specs };
    case "promo":
      return { type: "promo", tone: s.tone, kicker: s.kicker, heading: s.heading, body: s.body ?? "", ctaLabel: s.ctaLabel ?? "Escríbenos" };
    case "comparison":
      return {
        type: "comparison",
        heading: s.heading,
        usLabel: s.usLabel ?? "Nosotros",
        othersLabel: s.othersLabel ?? "Lo típico",
        rows: s.items.map((i) => ({ label: i.title, us: i.text, others: i.extra ?? "" })),
      };
    case "agenda":
      return { type: "agenda", kicker: s.kicker, heading: s.heading, items: s.items.map((i) => ({ when: i.extra ?? "", title: i.title, description: i.text })) };
    case "host":
      return { type: "host", kicker: s.kicker, heading: s.heading, name: s.name ?? "", role: s.role, body: s.body ?? "" };
    case "objections":
      return { type: "objections", kicker: s.kicker, heading: s.heading, items: s.items.map((i) => ({ question: i.title, answer: i.text })) };
    case "stats":
      return { type: "stats", items: s.items.map((i) => ({ value: i.title, label: i.text })) };
    case "gallery":
      return { type: "gallery", kicker: s.kicker, heading: s.heading };
    case "leadForm":
      return { type: "leadForm", kicker: s.kicker, heading: s.heading, body: s.body ?? "", buttonLabel: s.ctaLabel ?? "Quiero que me contacten" };
    case "cta":
      return { type: "cta", heading: s.heading, body: s.body ?? "", ctaLabel: s.ctaLabel ?? "Escríbenos" };
  }
}

/** AI section → stored section, or null when it can't be made valid. */
export function fromAiSection(s: AiSection): Section | null {
  const parsed = SectionSchema.safeParse(toTyped(s));
  return parsed.success ? parsed.data : null;
}

export function fromAiPage(page: AiPage): AiWebsiteV2 {
  return {
    pageType: page.pageType,
    style: page.style,
    announcement: page.announcement,
    theme: page.theme,
    sections: page.sections.map(fromAiSection).filter((s): s is Section => s !== null),
  };
}

const EMPTY: Omit<AiSection, "type" | "heading"> = {
  variant: null,
  tone: null,
  kicker: null,
  highlight: null,
  body: null,
  ctaLabel: null,
  secondaryCtaLabel: null,
  badge: null,
  chips: [],
  showLeadForm: null,
  showCategoryFilter: null,
  productId: null,
  productIds: [],
  name: null,
  role: null,
  usLabel: null,
  othersLabel: null,
  items: [],
  specs: [],
};

/** Stored section → AI format, so edits show the AI the same shape it returns. */
export function toAiSection(s: Section): AiSection {
  const base = { ...EMPTY, type: s.type, heading: "" } as AiSection;
  const it = (title: string, text: string, icon: AiSection["items"][number]["icon"] = null, extra: string | null = null) => ({ title, text, icon, extra });
  switch (s.type) {
    case "hero":
      return { ...base, variant: s.variant, kicker: s.eyebrow, heading: s.heading, highlight: s.highlight, body: s.subheading, chips: s.chips, showLeadForm: s.showLeadForm, ctaLabel: s.ctaLabel, secondaryCtaLabel: s.secondaryCtaLabel, badge: s.badge, productId: s.productId };
    case "trustBar":
      return { ...base, items: s.items.map((i) => it(i.title, i.description, i.icon)) };
    case "features":
      return { ...base, variant: s.variant, kicker: s.kicker, heading: s.heading, body: s.intro, items: s.items.map((i) => it(i.title, i.description, i.icon)) };
    case "steps":
      return { ...base, kicker: s.kicker, heading: s.heading, items: s.items.map((i) => it(i.title, i.description)) };
    case "productGrid":
      return { ...base, variant: s.variant, kicker: s.kicker, heading: s.heading, productIds: s.productIds, showCategoryFilter: s.showCategoryFilter };
    case "productSpotlight":
      return { ...base, productId: s.productId, heading: s.heading, items: s.bullets.map((i) => it(i.title, i.description, i.icon)), specs: s.specs };
    case "promo":
      return { ...base, tone: s.tone, kicker: s.kicker, heading: s.heading, body: s.body, ctaLabel: s.ctaLabel };
    case "comparison":
      return { ...base, heading: s.heading, usLabel: s.usLabel, othersLabel: s.othersLabel, items: s.rows.map((r) => it(r.label, r.us, null, r.others)) };
    case "agenda":
      return { ...base, kicker: s.kicker, heading: s.heading, items: s.items.map((i) => it(i.title, i.description, null, i.when)) };
    case "host":
      return { ...base, kicker: s.kicker, heading: s.heading, name: s.name, role: s.role, body: s.body };
    case "objections":
      return { ...base, kicker: s.kicker, heading: s.heading, items: s.items.map((i) => it(i.question, i.answer)) };
    case "stats":
      return { ...base, items: s.items.map((i) => it(i.value, i.label)) };
    case "gallery":
      return { ...base, kicker: s.kicker, heading: s.heading };
    case "leadForm":
      return { ...base, kicker: s.kicker, heading: s.heading, body: s.body, ctaLabel: s.buttonLabel };
    case "cta":
      return { ...base, heading: s.heading, body: s.body, ctaLabel: s.ctaLabel };
  }
}
