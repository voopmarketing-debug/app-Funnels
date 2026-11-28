import { z } from "zod";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import { LookSchema } from "@/lib/websiteLook";

// Version 2 of a generated page: instead of six fixed blocks, an ordered
// list of typed sections chosen per page type (servicios, producto, tienda,
// evento, captación) and one of 12 visual styles. Version 1 pages keep
// rendering with lib/websiteTemplate.ts; anything with `version: 2` goes
// through lib/websiteTemplateV2.ts.

export const PAGE_TYPES = ["servicios", "producto", "tienda", "evento", "captacion", "showroom", "historia"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  servicios: "Página de servicios",
  producto: "Venta de un producto",
  tienda: "Tienda / catálogo",
  evento: "Evento o lanzamiento",
  captacion: "Conseguir clientes y citas",
  showroom: "Showroom (productos para comparar)",
  historia: "Historia de marca (scroll)",
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

// Photos the owner puts on a section (picked from their own library, see
// actions.ts setWebsiteSectionImageV2): `bgImage` is the section's background
// (dark veil on top so the text stays readable), `image` replaces the section's
// main picture (portada, quién está detrás). Only https urls are ever stored.
const imageUrl = z
  .string()
  .max(2000)
  .regex(/^https:\/\//)
  .nullable()
  .optional()
  .catch(null);
// `look`: the owner's own style for this section (see websiteLook.ts).
// `extras`: elements the owner adds inside a block, right under its title (a text, a button).
export const MAX_EXTRAS = 6;
export const ExtraSchema = z.union([
  z.object({ type: z.literal("heading"), text: z.string().max(200) }),
  z.object({ type: z.literal("text"), text: z.string().max(600) }),
  z.object({ type: z.literal("image"), url: z.string().regex(/^https:\/\/\S+$/).max(500) }),
  z.object({ type: z.literal("button"), label: z.string().max(40), url: z.string().regex(/^$|^(https?:\/\/\S+|tel:\+?[0-9 ()-]{5,20}|mailto:\S+@\S+|#[A-Za-z0-9_-]+)$/).max(300) }),
]);
export type ExtraElement = z.infer<typeof ExtraSchema>;
const ExtrasSchema = z.array(ExtraSchema).max(MAX_EXTRAS).optional().catch(undefined).describe("Elementos que agrega el dueño. NO lo escribas.");
// `fc`: a color of its own for one text of the block (key = the text's path inside the block, e.g. "heading" or "items.1.title").
export const FIELD_COLOR_KEY = /^[A-Za-z0-9.]{1,40}$/;
export const FIELD_COLOR_VALUE = /^#[0-9a-fA-F]{6}$/;
const FieldColorsSchema = z.record(z.string().regex(FIELD_COLOR_KEY), z.string().regex(FIELD_COLOR_VALUE)).optional().catch(undefined).describe("Colores de textos sueltos. NO lo escribas.");
// `links`: the address of each button of the block that goes somewhere of its own (key = the button text's field, e.g. "ctaLabel").
export const BUTTON_LINK = /^(https?:\/\/\S+|tel:\+?[0-9 ()-]{5,20}|mailto:\S+@\S+|#[A-Za-z0-9_-]+)$/;
const ButtonLinksSchema = z.record(z.string().regex(FIELD_COLOR_KEY), z.string().regex(BUTTON_LINK).max(300)).optional().catch(undefined).describe("Enlaces propios de los botones. NO lo escribas.");
// `nums`: the numbers drawn in a block ("01", "02 / 06") when the owner writes their own (keys: "i0", "i1"… for the items, "c" for the counter).
const NumsSchema = z.record(z.string().regex(/^[a-z0-9]{1,6}$/), z.string().max(12)).optional().catch(undefined).describe("Números propios. NO lo escribas.");
// `navLabel`: the name this block has in the top menu.
const NavLabelSchema = z.string().max(24).optional().catch(undefined).describe("Nombre en el menú. NO lo escribas.");
// `bs`: the look of one button of the block (key = the button text's field): its own background, text color and shape.
export const ButtonStyleSchema = z.object({
  bg: z.string().regex(FIELD_COLOR_VALUE).nullable().optional().catch(null),
  color: z.string().regex(FIELD_COLOR_VALUE).nullable().optional().catch(null),
  shape: z.enum(["square", "soft", "round"]).nullable().optional().catch(null),
  /** Width of the button in % of its space (20 to 100), height of its padding in px (6 to 50), size of its letters in % (50 to 200). */
  w: z.string().regex(/^(?:[2-9]\d|100)$/).nullable().optional().catch(null),
  h: z.string().regex(/^(?:[6-9]|[1-4]\d|50)$/).nullable().optional().catch(null),
  fs: z.string().regex(/^(?:[5-9]\d|1\d\d|200)$/).nullable().optional().catch(null),
});
export type ButtonStyle = z.infer<typeof ButtonStyleSchema>;
const ButtonStylesSchema = z.record(z.string().regex(FIELD_COLOR_KEY), ButtonStyleSchema).optional().catch(undefined).describe("Estilo propio de botones. NO lo escribas.");
const media = { bs: ButtonStylesSchema, nums: NumsSchema, navLabel: NavLabelSchema, image: imageUrl, bgImage: imageUrl, look: LookSchema, extras: ExtrasSchema, fc: FieldColorsSchema, links: ButtonLinksSchema };

const HeroSection = z.object({
  ...media,
  type: z.literal("hero"),
  variant: z
    .enum(["split", "centered", "fullbleed", "product", "giant", "blank", "wordmark"])
    .catch("split")
    .describe("split: texto + imagen; centered: solo texto centrado; fullbleed: imagen de fondo a sangre; product: producto protagonista con precio; giant: titular gigante tipo campaña; wordmark: el nombre del negocio gigante como logotipo y el titular debajo; blank: sin portada visible (solo para páginas en blanco, nunca lo uses)."),
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
  ...media,
  type: z.literal("trustBar"),
  variant: z.enum(["row", "ticker"]).optional().catch(undefined),
  items: z
    .array(z.object({ icon: z.enum(ICON_KEYS).catch("check"), title: z.string(), description: z.string() }))
    .describe("Garantías de compra/servicio REALES (envío, pagos, cambios, soporte). Nada inventado."),
});

const FeaturesSection = z.object({
  ...media,
  type: z.literal("features"),
  variant: z.enum(["cards", "icons", "list", "bento", "numbered"]).catch("cards"),
  kicker: nullableText("Etiqueta pequeña sobre el título, ej. 'Lo que ofrecemos'."),
  heading: text(80, "Título con beneficio, no una etiqueta"),
  intro: nullableText("Frase corta opcional bajo el título."),
  items: z.array(item.extend({ icon: z.enum(ICON_KEYS).catch("check") })),
});

const StepsSection = z.object({
  ...media,
  type: z.literal("steps"),
  variant: z.enum(["row", "timeline", "big"]).optional().catch(undefined),
  kicker: nullableText("Etiqueta pequeña, ej. 'Cómo funciona'."),
  heading: text(80, "Título con beneficio"),
  items: z.array(item),
});

const ProductGridSection = z.object({
  ...media,
  type: z.literal("productGrid"),
  variant: z.enum(["grid", "row", "featured"]).catch("grid").describe("grid: rejilla completa; row: fila destacada; featured: tarjetas grandes con descripción (más vendidos)."),
  kicker: nullableText("Etiqueta pequeña, ej. 'Novedades'."),
  heading: text(60, "Título de la sección de productos"),
  productIds: z.array(z.string()).describe("Ids de PRODUCTOS a mostrar, en orden. Lista vacía = todos."),
  showCategoryFilter: z.boolean().catch(false).describe("true para mostrar las categorías como pestañas (tienda)."),
});

const SpotlightSection = z.object({
  ...media,
  type: z.literal("productSpotlight"),
  productId: z.string().describe("Id del producto protagonista."),
  heading: text(80, "Por qué este producto"),
  bullets: z.array(item.extend({ icon: z.enum(ICON_KEYS).catch("check") })),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("Especificaciones SOLO con datos dados en la descripción del producto. Vacío si no hay."),
});

const PromoSection = z.object({
  ...media,
  type: z.literal("promo"),
  tone: z.enum(["dark", "accent", "soft"]).catch("dark"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Solo en {mes}' (el token {mes} se cambia solo por el mes actual; solo si la oferta es real)."),
  heading: text(70, "Mensaje de la franja promocional"),
  body: text(160, "Detalle de la promoción o invitación"),
  ctaLabel: text(30, "Botón"),
  countdown: z.boolean().optional().catch(undefined).describe("true para mostrar la cuenta regresiva en vivo hasta el último día del mes."),
  seal: z.string().nullable().optional().catch(undefined).describe("Sello circular sobre la imagen, ej. '-15 %'. SOLO si es un dato real."),
});

const ShowroomSection = z.object({
  ...media,
  type: z.literal("showroom"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Conócelos de cerca'."),
  heading: text(80, "Título del visor de productos"),
  productIds: z.array(z.string()).describe("Ids de PRODUCTOS (con foto) que se pueden elegir y girar. Lista vacía = los primeros con foto."),
  bubbles: z
    .array(item)
    .describe("2 a 4 características que se señalan con globos de chat sobre el producto. SOLO datos reales (materiales, garantía, tecnología)."),
  facts: z.array(z.object({ title: z.string(), description: z.string() })).describe("Hasta 3 datos clave reales con ícono (garantía, entrega, financiación)."),
});

const QuoterSection = z.object({
  ...media,
  type: z.literal("quoter"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Cotizador'."),
  heading: text(80, "Título del cotizador por presupuesto"),
  intro: nullableText("Frase corta bajo el título."),
  productIds: z.array(z.string()).describe("Ids de PRODUCTOS con precio a comparar contra el presupuesto. Lista vacía = todos los que tengan precio."),
  months: z.number().int().min(1).max(120).catch(48).describe("Plazo en meses para el modo 'cuota mensual' (simulación sin intereses)."),
  note: nullableText("Aviso bajo el cotizador. Por defecto: simulación de referencia."),
});

const FanSection = z.object({
  ...media,
  type: z.literal("fan"),
  kicker: nullableText("Etiqueta pequeña, ej. 'La colección'."),
  heading: text(80, "Título de la colección en abanico"),
  intro: nullableText("Frase corta bajo el título."),
  productIds: z.array(z.string()).describe("Ids de PRODUCTOS (con foto) de la colección, en orden. Lista vacía = todos."),
});

const TravelerSection = z.object({
  ...media,
  type: z.literal("traveler"),
  kicker: nullableText("Etiqueta pequeña, ej. 'El ritual'."),
  heading: text(80, "Título de la sección del producto viajero"),
  productId: z.string().describe("Id del producto (con foto) que acompaña el scroll y cambia de lugar, tamaño y giro en cada escena."),
  scenes: z.array(item).describe("2 a 4 escenas: cada una es un momento del ritual o de la historia del producto (título + texto corto, datos reales)."),
});

// The container: columns (a structure) that hold the elements the owner puts in each one.
const LayoutSection = z.object({
  ...media,
  type: z.literal("layout"),
  structure: z.string().max(8).nullable().optional().catch(null),
  cells: z.array(z.object({ w: z.number().int().min(1).max(12), row: z.number().int().min(0).max(8), items: z.array(ExtraSchema).max(8) })).max(16).catch([]),
});

const MarqueeSection = z.object({
  ...media,
  type: z.literal("marquee"),
  lines: z.array(z.string()).describe("1 o 2 frases cortas en mayúsculas que se desplazan gigantes, en direcciones opuestas."),
});

export const VideoOptsSchema = z
  .object({
    start: z.number().int().min(1).max(86400).optional().catch(undefined),
    end: z.number().int().min(1).max(86400).optional().catch(undefined),
    autoplay: z.literal(true).optional().catch(undefined),
    mute: z.literal(true).optional().catch(undefined),
    loop: z.literal(true).optional().catch(undefined),
    controls: z.literal(false).optional().catch(undefined),
    related: z.literal(false).optional().catch(undefined),
  })
  .optional()
  .catch(undefined);

const VideoSection = z.object({
  ...media,
  type: z.literal("video"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Míralo en 2 minutos'."),
  heading: text(80, "Título sobre el video"),
  intro: nullableText("Frase corta bajo el título."),
  url: z.string().catch("").describe("Enlace del video (YouTube, Vimeo, Wistia o Loom). Vacío si el dueño aún no lo ha pegado: NUNCA inventes un enlace."),
  opts: VideoOptsSchema,
});

export const HTML_MAX_CHARS = 100_000;

/** Why pasted code looks cut off (a tag opened and never closed), in plain Spanish; null when it looks complete. A copy that stops halfway would otherwise show a blank page. */
export function incompleteHtmlReason(code: string): string | null {
  for (const tag of ["style", "script", "body", "html"]) {
    const opened = (code.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length;
    const closed = (code.match(new RegExp(`</${tag}\\s*>`, "gi")) ?? []).length;
    if (opened > closed) return `Al código le falta el final (no se cierra </${tag}>). Parece que se copió incompleto: vuelve a copiarlo completo, o sube el archivo .html.`;
  }
  return null;
}

const HtmlSection = z.object({
  ...media,
  type: z.literal("html"),
  code: z.string().max(HTML_MAX_CHARS).catch("").describe("Código HTML/CSS/JS que pegó el dueño. NUNCA lo escribas ni lo cambies tú."),
  height: z.number().int().min(0).max(3000).catch(0).describe("Alto en píxeles; 0 = se ajusta solo al contenido."),
});

const EventSection = z.object({
  ...media,
  type: z.literal("event"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Próxima fecha'."),
  heading: text(80, "Título de la tarjeta de fecha"),
  when: z.string().catch("").describe("Fecha y hora tal como las escribe el dueño. NUNCA las inventes: vacío si no las dieron."),
  where: z.string().catch("").describe("Lugar o modalidad (en línea, dirección). Vacío si no lo dieron."),
  date: z.string().catch("").describe("Fecha exacta en formato ISO para la cuenta regresiva. Solo la pone el dueño; vacío si no."),
  ctaLabel: text(30, "Botón, ej. 'Reservar mi lugar'"),
});

const OfferSection = z.object({
  ...media,
  type: z.literal("offer"),
  kicker: nullableText("Etiqueta pequeña, ej. 'Tu oferta'."),
  heading: text(80, "Nombre de la oferta"),
  body: text(300, "Qué recibe quien la toma"),
  price: z.string().catch("").describe("Precio tal como lo escribe el dueño. NUNCA lo inventes: vacío si no lo dieron."),
  priceNote: nullableText("Aclaración del precio, ej. 'Pago único'. Solo si es real."),
  includes: z.array(z.string()).catch([]).describe("Lo que incluye, una línea cada ítem. Solo cosas reales."),
  ctaLabel: text(30, "Botón de la oferta"),
});

const GuaranteeSection = z.object({
  ...media,
  type: z.literal("guarantee"),
  heading: text(80, "Título de la garantía"),
  body: text(400, "Términos reales de la garantía. NUNCA inventes plazos ni condiciones."),
});

const TestimonialsSection = z.object({
  ...media,
  type: z.literal("testimonials"),
  kicker: nullableText("Etiqueta pequeña."),
  heading: text(80, "Título de los testimonios"),
  items: z.array(z.object({ quote: z.string().catch(""), name: z.string().catch(""), role: z.string().catch("") })).describe("Solo testimonios REALES que dio el dueño, con permiso de quien los dijo. NUNCA los inventes."),
});

const ComparisonSection = z.object({
  ...media,
  type: z.literal("comparison"),
  heading: text(80, "Título de la comparación"),
  usLabel: text(30, "Nombre de la columna propia (el negocio o producto)"),
  othersLabel: text(30, "Columna de comparación, ej. 'Lo típico' o 'Otras opciones'"),
  rows: z.array(z.object({ label: z.string(), us: z.string(), others: z.string() })),
});

const AgendaSection = z.object({
  ...media,
  type: z.literal("agenda"),
  kicker: nullableText("Etiqueta, ej. 'Agenda del evento'."),
  heading: text(80, "Título de la agenda"),
  items: z
    .array(z.object({ when: z.string(), title: z.string(), description: z.string() }))
    .describe("Sesiones o momentos REALES del evento con su fecha/hora tal como te la dieron."),
});

const HostSection = z.object({
  ...media,
  type: z.literal("host"),
  kicker: nullableText("Etiqueta, ej. 'Quién te acompaña'."),
  heading: text(80, "Título"),
  name: z.string(),
  role: nullableText("Cargo o especialidad."),
  body: text(500, "Presentación real de la persona o del negocio"),
});

const ObjectionsSection = z.object({
  ...media,
  type: z.literal("objections"),
  variant: z.enum(["list", "split"]).optional().catch(undefined),
  kicker: nullableText("Etiqueta, ej. 'Preguntas frecuentes'."),
  heading: text(80, "Título que desactive la duda principal"),
  items: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const StatsSection = z.object({
  ...media,
  type: z.literal("stats"),
  items: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .describe("SOLO cifras reales dadas en los datos. Si no hay cifras reales, NO uses esta sección."),
});

const GallerySection = z.object({
  ...media,
  type: z.literal("gallery"),
  kicker: nullableText("Etiqueta pequeña."),
  heading: text(70, "Título de la galería (usa las FOTOS reales del negocio)"),
  layout: z.enum(["grid", "mosaic", "carousel"]).optional().catch(undefined).describe("Diseño de la galería. NO lo escribas: lo elige el dueño."),
});

const LeadFormSection = z.object({
  ...media,
  type: z.literal("leadForm"),
  kicker: nullableText("Etiqueta pequeña."),
  heading: text(80, "Invitación a dejar sus datos"),
  body: text(200, "Qué recibe a cambio y que no hay compromiso"),
  buttonLabel: text(30, "Texto del botón del formulario"),
});

const CtaSection = z.object({
  ...media,
  type: z.literal("cta"),
  variant: z.enum(["band", "giant"]).optional().catch(undefined),
  heading: text(80, "Invitación final a dar el paso hoy"),
  body: text(180, "Frase que reduzca el riesgo de escribir"),
  ctaLabel: text(30, "Botón"),
});

export const SectionSchema = z.discriminatedUnion("type", [
  HeroSection,
  LayoutSection,
  TrustBarSection,
  FeaturesSection,
  StepsSection,
  ProductGridSection,
  SpotlightSection,
  PromoSection,
  ShowroomSection,
  QuoterSection,
  FanSection,
  TravelerSection,
  MarqueeSection,
  VideoSection,
  HtmlSection,
  EventSection,
  OfferSection,
  GuaranteeSection,
  TestimonialsSection,
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
  layout: "Contenedor",
  trustBar: "Garantías",
  features: "Beneficios",
  steps: "Cómo funciona",
  productGrid: "Productos",
  productSpotlight: "Producto destacado",
  promo: "Franja promocional",
  showroom: "Visor de productos",
  quoter: "Cotizador",
  fan: "Colección en abanico",
  traveler: "Producto viajero",
  marquee: "Texto en movimiento",
  video: "Video",
  html: "Código HTML",
  event: "Fecha del evento",
  offer: "Oferta",
  guarantee: "Garantía",
  testimonials: "Testimonios",
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
  backgroundColor: hexColor("#fafaf7").describe("Fondo claro: blanco o blanco con un tinte muy suave. Nunca oscuro."),
  surfaceColor: hexColor("#f1f0eb").describe("Fondo de tarjetas y franjas alternas, un paso más claro u oscuro que el fondo."),
  textColor: hexColor("#141414").describe("Texto principal, contraste ≥7:1 con el fondo."),
  headingFont: z.enum(FONT_OPTIONS).catch("Inter"),
  bodyFont: z.enum(FONT_OPTIONS).catch("Inter"),
});

const chromeHex = z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional().catch(null);
const chromeText = (max: number) => z.string().max(max).nullable().optional().catch(null);
export const ChromeSchema = z
  .object({
    logo: imageUrl,
    brandName: chromeText(60),
    headerLabel: chromeText(30),
    headerLink: z.string().regex(BUTTON_LINK).max(300).nullable().optional().catch(null),
    headerBg: chromeHex,
    headerColor: chromeHex,
    headerBtn: chromeHex,
    footerText: chromeText(120),
    footerLink: chromeText(60),
    footerBg: chromeHex,
    footerColor: chromeHex,
  })
  .optional()
  .catch(undefined);
export type Chrome = NonNullable<z.infer<typeof ChromeSchema>>;

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
  /** Small mono counters ("02 / 08") before each section's label. A look the template sets; the AI never decides it. */
  counters: z.boolean().optional().catch(undefined),
  /** The kind of business (a niche id) whose drawing fills the empty photo spaces in the editor and the previews. */
  art: z.string().max(24).optional().catch(undefined),
  /** Addresses of the pictures the platform created with AI on this page (so they can be counted, replaced or removed). */
  /** The public page shows only the owner's HTML block, with no header, footer or sections of ours ("Subir mi HTML"). */
  fullHtml: z.boolean().optional().catch(undefined),
  /** Shape of every button of the page (a block can have its own): square, soft or round. */
  btnShape: z.enum(["square", "soft", "round"]).optional().catch(undefined),
  /** The page's own top bar and footer: logo, name, colors and footer texts (all optional; what is empty stays automatic). */
  chrome: ChromeSchema,
  /** Without our top bar (name + button) and our footer: the page is only its blocks. */
  plain: z.boolean().optional().catch(undefined),
  /** A fixed button at the bottom of the screen on phones (landing and funnel pages). */
  sticky: z.boolean().optional().catch(undefined),
  /** Where the visitor goes after sending the form. Empty: the page itself, with a thank-you message. */
  thankYouUrl: z.string().regex(/^https?:\/\/\S+$/).max(500).nullable().optional().catch(undefined),
  aiImages: z.array(z.string()).max(12).optional().catch(undefined),
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
  // Photos from other angles: with 3 or more, the viewer turns through all of them.
  galleryUrls?: string[];
  badge: string | null;
  // Tracks inventory and has no units left: shown as "Agotado", no order button.
  soldOut?: boolean;
  // A service (consulta, clase…): "Agendar" instead of "Pedir".
  isService?: boolean;
};

export { formatMoney } from "@/lib/currency";
