import { z } from "zod";
import { FONT_OPTIONS } from "@/lib/websiteContent";

// Version 2 of a generated page: instead of six fixed blocks, an ordered
// list of typed sections chosen per page type (servicios, producto, tienda,
// evento, captación) and one of 12 visual styles. Version 1 pages keep
// rendering with lib/websiteTemplate.ts; anything with `version: 2` goes
// through lib/websiteTemplateV2.ts.

export const PAGE_TYPES = ["servicios", "producto", "tienda", "evento", "captacion"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  servicios: "Página de servicios",
  producto: "Venta de un producto",
  tienda: "Tienda / catálogo",
  evento: "Evento o lanzamiento",
  captacion: "Conseguir clientes y citas",
};

export const STYLE_KEYS = [
  "editorial",
  "bold",
  "tech",
  "clinico",
  "calido",
  "gourmet",
  "producto",
  "tienda",
  "lanzamiento",
  "corporativo",
  "pop",
  "lujo",
] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

export const STYLE_INFO: Record<StyleKey, { label: string; summary: string }> = {
  editorial: { label: "Editorial minimal", summary: "Lujo silencioso, serif grande y mucho aire." },
  bold: { label: "Bold tipográfico", summary: "Titulares gigantes y bloques de color plano." },
  tech: { label: "Tech preciso", summary: "Oscuro profundo, bordes finos y números grandes." },
  clinico: { label: "Clínico sereno", summary: "Limpio, calmado y muy legible." },
  calido: { label: "Cálido humano", summary: "Cercano, orgánico y con personas reales." },
  gourmet: { label: "Gourmet sensorial", summary: "Apetitoso, fotos a sangre y tipografía con carácter." },
  producto: { label: "Producto protagonista", summary: "Ficha de producto que vende: galería, precio y garantías." },
  tienda: { label: "Tienda limpia", summary: "Catálogo ordenado con categorías, badges y precios." },
  lanzamiento: { label: "Lanzamiento / evento", summary: "Oscuro con acento eléctrico, fecha y agenda protagonistas." },
  corporativo: { label: "Corporativo confiable", summary: "Sobrio, ordenado y con proceso claro." },
  pop: { label: "Pop divertido", summary: "Colores vivos, esquinas redondas y tono simpático." },
  lujo: { label: "Lujo oscuro", summary: "Negro tintado, dorado apagado y serif elegante." },
};

export const ICON_KEYS = [
  "truck",
  "shield",
  "card",
  "refresh",
  "star",
  "clock",
  "heart",
  "leaf",
  "bolt",
  "chat",
  "calendar",
  "check",
  "gift",
  "sparkle",
  "users",
  "map",
] as const;

// See websiteContent.ts: hex only, because these go straight into <style>.
function hexColor(fallback: string) {
  return z
    .string()
    .regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}){0,2}$/)
    .catch(fallback);
}

const text = (max: number, hint: string) => z.string().describe(`${hint} (máx. ${max} caracteres)`);
const nullableText = (hint: string) => z.string().nullable().catch(null).describe(hint);

const item = z.object({ title: z.string(), description: z.string() });

const HeroSection = z.object({
  type: z.literal("hero"),
  variant: z
    .enum(["split", "centered", "fullbleed", "product", "giant"])
    .catch("split")
    .describe("split: texto + imagen; centered: solo texto centrado; fullbleed: imagen de fondo a sangre; product: producto protagonista con precio; giant: titular gigante tipo campaña."),
  eyebrow: nullableText("Etiqueta corta sobre el titular, ej. 'Nueva colección' o 'Envíos a todo el país'."),
  heading: text(70, "Titular principal: la promesa concreta"),
  highlight: nullableText("1 a 4 palabras EXACTAS del heading que se pintan con el color de acento (ej. 'en 30 días'). null si no aplica."),
  subheading: text(180, "Una o dos frases que amplían el titular"),
  chips: z
    .array(z.string())
    .catch([])
    .describe("Datos clave cortos junto al botón, SOLO reales: fecha, hora, modalidad, lugar, 'Envío gratis'. Máx. 3. Vacío si no hay."),
  showLeadForm: z
    .boolean()
    .catch(false)
    .describe("true para poner el formulario de registro dentro de la portada (eventos, captación). false en tiendas y servicios."),
  ctaLabel: text(30, "Botón principal, empieza con verbo"),
  secondaryCtaLabel: nullableText("Botón secundario opcional, ej. 'Ver catálogo'. null si no aplica."),
  badge: nullableText("Sello corto en el hero SOLO si es real, ej. '-20% esta semana'. null si no hay dato real."),
  productId: nullableText("Solo para variant 'product': id de un producto de la lista PRODUCTOS."),
});

const TrustBarSection = z.object({
  type: z.literal("trustBar"),
  items: z
    .array(z.object({ icon: z.enum(ICON_KEYS).catch("check"), title: z.string(), description: z.string() }))
    .describe("Garantías de compra/servicio REALES (envío, pagos, cambios, soporte). Nada inventado."),
});

const FeaturesSection = z.object({
  type: z.literal("features"),
  variant: z.enum(["cards", "icons", "list"]).catch("cards"),
  kicker: nullableText("Etiqueta pequeña sobre el título, ej. 'Lo que ofrecemos'."),
  heading: text(80, "Título con beneficio, no una etiqueta"),
  intro: nullableText("Frase corta opcional bajo el título."),
  items: z.array(item.extend({ icon: z.enum(ICON_KEYS).catch("check") })),
});

const StepsSection = z.object({
  type: z.literal("steps"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Cómo funciona'."),
  heading: text(80, "Título con beneficio"),
  items: z.array(item),
});

const ProductGridSection = z.object({
  type: z.literal("productGrid"),
  variant: z.enum(["grid", "row", "featured"]).catch("grid").describe("grid: rejilla completa; row: fila destacada; featured: tarjetas grandes con descripción (más vendidos)."),
  kicker: nullableText("Etiqueta pequeña, ej. 'Novedades'."),
  heading: text(60, "Título de la sección de productos"),
  productIds: z.array(z.string()).describe("Ids de PRODUCTOS a mostrar, en orden. Lista vacía = todos."),
  showCategoryFilter: z.boolean().catch(false).describe("true para mostrar las categorías como pestañas (tienda)."),
});

const SpotlightSection = z.object({
  type: z.literal("productSpotlight"),
  productId: z.string().describe("Id del producto protagonista."),
  heading: text(80, "Por qué este producto"),
  bullets: z.array(item.extend({ icon: z.enum(ICON_KEYS).catch("check") })),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("Especificaciones SOLO con datos dados en la descripción del producto. Vacío si no hay."),
});

const PromoSection = z.object({
  type: z.literal("promo"),
  tone: z.enum(["dark", "accent", "soft"]).catch("dark"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Oferta de temporada' (solo si es real)."),
  heading: text(70, "Mensaje de la franja promocional"),
  body: text(160, "Detalle de la promoción o invitación"),
  ctaLabel: text(30, "Botón"),
});

const ComparisonSection = z.object({
  type: z.literal("comparison"),
  heading: text(80, "Título de la comparación"),
  usLabel: text(30, "Nombre de la columna propia (el negocio o producto)"),
  othersLabel: text(30, "Columna de comparación, ej. 'Lo típico' o 'Otras opciones'"),
  rows: z.array(z.object({ label: z.string(), us: z.string(), others: z.string() })),
});

const AgendaSection = z.object({
  type: z.literal("agenda"),
  kicker: nullableText("Etiqueta, ej. 'Agenda del evento'."),
  heading: text(80, "Título de la agenda"),
  items: z
    .array(z.object({ when: z.string(), title: z.string(), description: z.string() }))
    .describe("Sesiones o momentos REALES del evento con su fecha/hora tal como te la dieron."),
});

const HostSection = z.object({
  type: z.literal("host"),
  kicker: nullableText("Etiqueta, ej. 'Quién te acompaña'."),
  heading: text(80, "Título"),
  name: z.string(),
  role: nullableText("Cargo o especialidad."),
  body: text(500, "Presentación real de la persona o del negocio"),
});

const ObjectionsSection = z.object({
  type: z.literal("objections"),
  kicker: nullableText("Etiqueta, ej. 'Preguntas frecuentes'."),
  heading: text(80, "Título que desactive la duda principal"),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const StatsSection = z.object({
  type: z.literal("stats"),
  items: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .describe("SOLO cifras reales dadas en los datos. Si no hay cifras reales, NO uses esta sección."),
});

const GallerySection = z.object({
  type: z.literal("gallery"),
  kicker: nullableText("Etiqueta pequeña."),
  heading: text(70, "Título de la galería (usa las FOTOS reales del negocio)"),
});

const LeadFormSection = z.object({
  type: z.literal("leadForm"),
  kicker: nullableText("Etiqueta pequeña."),
  heading: text(80, "Invitación a dejar sus datos"),
  body: text(200, "Qué recibe a cambio y que no hay compromiso"),
  buttonLabel: text(30, "Texto del botón del formulario"),
});

const CtaSection = z.object({
  type: z.literal("cta"),
  heading: text(80, "Invitación final a dar el paso hoy"),
  body: text(180, "Frase que reduzca el riesgo de escribir"),
  ctaLabel: text(30, "Botón"),
});

export const SectionSchema = z.discriminatedUnion("type", [
  HeroSection,
  TrustBarSection,
  FeaturesSection,
  StepsSection,
  ProductGridSection,
  SpotlightSection,
  PromoSection,
  ComparisonSection,
  AgendaSection,
  HostSection,
  ObjectionsSection,
  StatsSection,
  GallerySection,
  LeadFormSection,
  CtaSection,
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Portada",
  trustBar: "Garantías",
  features: "Beneficios",
  steps: "Cómo funciona",
  productGrid: "Productos",
  productSpotlight: "Producto destacado",
  promo: "Franja promocional",
  comparison: "Comparación",
  agenda: "Agenda",
  host: "Quién está detrás",
  objections: "Preguntas frecuentes",
  stats: "Cifras",
  gallery: "Galería",
  leadForm: "Formulario",
  cta: "Llamado final",
};

export const ThemeSchema = z.object({
  primaryColor: hexColor("#1f6feb").describe("Acento único (botones, enlaces). Contraste ≥4.5:1 con el fondo."),
  backgroundColor: hexColor("#fafaf7").describe("Fondo. Nunca #ffffff ni #000000 puros."),
  surfaceColor: hexColor("#f1f0eb").describe("Fondo de tarjetas y franjas alternas, un paso más claro u oscuro que el fondo."),
  textColor: hexColor("#141414").describe("Texto principal, contraste ≥7:1 con el fondo."),
  headingFont: z.enum(FONT_OPTIONS).catch("Inter"),
  bodyFont: z.enum(FONT_OPTIONS).catch("Inter"),
});

// What the AI returns.
export const AiWebsiteV2Schema = z.object({
  pageType: z.enum(PAGE_TYPES).catch("servicios"),
  style: z.enum(STYLE_KEYS).catch("editorial"),
  announcement: nullableText("Barra superior corta SOLO con un dato real (envío gratis desde X, horario, promo real). null si no hay."),
  theme: ThemeSchema,
  sections: z.array(SectionSchema).describe("Secciones en orden. La primera siempre es 'hero'."),
});
export type AiWebsiteV2 = z.infer<typeof AiWebsiteV2Schema>;

// What's stored on Website.content. `hidden` is the owner's per-section
// toggle — UI state, never decided by the AI.
export const WebsiteContentV2Schema = AiWebsiteV2Schema.extend({
  version: z.literal(2),
  hidden: z.array(z.number().int()).catch([]),
  heroCtaUrl: z.string().regex(/^$|^https?:\/\/.+/).nullable().catch(null),
});
export type WebsiteContentV2 = z.infer<typeof WebsiteContentV2Schema>;

export function isV2Content(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2;
}

// Data the renderer and generator need about the business's catalog.
export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  badge: string | null;
  // Tracks inventory and has no units left: shown as "Agotado", no order button.
  soldOut?: boolean;
  // A service (consulta, clase…): "Agendar" instead of "Pedir".
  isService?: boolean;
};

export function formatMoney(value: number, currency: string): string {
  if (currency === "USD") return `US$${value.toLocaleString("en-US")}`;
  return `$${value.toLocaleString("es-CO")}`;
}
