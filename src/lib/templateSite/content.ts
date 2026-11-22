import { z } from "zod";

// "Template sites": pages built on two hand-designed templates, Showroom (products
// you compare: cars, motorbikes, property, plans) and Scroll Story (brand and ritual
// products: cosmetics, drinks, food). The AI only fills the texts and the few facts
// below; the layout, the animations and the interactions are fixed code
// (showroom.ts / story.ts). The catalog (products, photos, prices) is read at render time.

export const TEMPLATE_KEYS = ["showroom", "story"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_FONTS: Record<TemplateKey, string[]> = {
  showroom: ["Manrope", "Inter Tight", "IBM Plex Mono"],
  story: ["Instrument Serif", "Figtree", "DM Mono"],
};

export const ICON_NAMES = [
  "gauge", "gear", "box", "road", "seat", "bolt", "tow", "tag", "calendar", "shield", "star", "check",
  "card", "refresh", "doc", "clock", "pin", "truck", "heart", "chat", "key", "leaf", "drop", "sparkle",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

const icon = z.enum(ICON_NAMES).catch("check");
const s = (fallback = "") => z.string().catch(fallback);
const sn = () => z.string().nullable().catch(null);
const hex = (fallback: string) => z.string().regex(/^#[0-9a-fA-F]{6}$/).catch(fallback);

const Stat = z.object({ icon, label: s(), value: s() });
const Bubble = z.object({ title: s(), text: s() });
const Card = z.object({ icon, title: s(), text: s() });

const Promo = z.object({
  tag: s("Solo en {mes}").describe("Etiqueta con punto que late. {mes} se cambia solo por el mes actual."),
  title: s(),
  text: s(),
  cta: s("Quiero la oferta"),
  stamp: sn().describe("Sello circular (ej. '-15 %', '+$5 M'). SOLO con un dato real; null si no hay."),
  countdown: z.boolean().catch(false).describe("true solo si la oferta de verdad cierra el último día del mes."),
});

const Base = {
  version: z.literal(3),
  brand: z.object({
    name: s("Marca").describe("Nombre de la marca tal como se escribe en el logo."),
    accent: hex("#3457ff").describe("Color de acento (hex). Usa el de la marca si lo hay."),
  }),
  ticker: z.array(z.string()).catch([]).describe("3 a 5 frases cortas de beneficios REALES para la cinta en movimiento."),
  promo: Promo,
};

// What the AI says about each catalog product (matched by id). Only facts that are in the
// product's own description; anything else stays empty and the page leaves it out.
const ShowroomItem = z.object({
  productId: s(),
  sub: sn().describe("Línea corta bajo el nombre (ej. 'Sedán · 2025 · 0 km'), solo con datos reales."),
  stats: z.array(Stat).catch([]).describe("Hasta 3 datos clave reales del producto (potencia, caja, baúl…). Vacío si la descripción no los da."),
  bubbles: z.array(Bubble).catch([]).describe("Hasta 3 características reales para los globos del visor."),
});

export const ShowroomSchema = z.object({
  ...Base,
  template: z.literal("showroom"),
  noun: s("producto").describe("Cómo se llama lo que vende, en minúscula y singular: carro, moto, apartamento, plan."),
  hero: z.object({
    title: s().describe("Titular grande: la promesa concreta (máx. 10 palabras)."),
    text: s().describe("Una o dos frases: qué puede hacer el visitante aquí."),
    primaryCta: s("Cotizar con mi presupuesto"),
    secondaryCta: s("Agendar visita"),
  }),
  items: z.array(ShowroomItem).catch([]),
  quote: z.object({
    kicker: s("Cotizador"),
    title: s("¿Cuánto quieres invertir?"),
    text: s("Mueve la barra con tu presupuesto y te mostramos qué te alcanza."),
    months: z.number().int().min(1).max(120).catch(48).describe("Plazo en meses para la cuota."),
    ratePct: z.number().min(0).max(10).nullable().catch(null).describe("Tasa mensual de referencia en %, SOLO si el cliente la dio; null = sin intereses."),
    downPct: z.number().min(0).max(90).catch(0).describe("Cuota inicial en %, SOLO si el cliente la dio; 0 si no."),
  }),
  services: z.object({
    kicker: s(),
    title: s(),
    text: s(),
    cards: z.array(Card).catch([]).describe("3 beneficios del servicio (financiación, retoma, entrega…), SOLO reales."),
    trade: z
      .object({ kicker: s(), title: s(), text: s(), cta: s("Quiero saber más") })
      .nullable()
      .catch(null)
      .describe("Franja grande con imagen y botón (ej. 'Recibimos tu carro actual'). null si no aplica."),
    side: z.array(z.object({ icon, value: s(), label: s() })).catch([]).describe("3 cifras REALES; vacío si no hay."),
  }),
  visit: z.object({
    kicker: s("Visita"),
    title: s("Agenda tu visita"),
    text: s(),
    where: z.array(z.object({ icon, label: s(), text: s() })).catch([]).describe("Hasta 3 tarjetas: dirección, horario, qué traer. SOLO datos reales."),
    button: s("Pedir mi visita"),
  }),
  footer: s(),
});
export type ShowroomContent = z.infer<typeof ShowroomSchema>;

const StoryItem = z.object({
  productId: s(),
  zone: sn().describe("Zona o categoría corta (ej. 'Facial')."),
  what: sn().describe("Qué es, con datos de la descripción del producto."),
  results: sn().describe("Resultados, SOLO si la descripción los da."),
  duration: sn(),
  sessions: sn(),
  after: sn().describe("Qué esperar después, SOLO si se conoce."),
  pack: sn().describe("Plan o paquete, SOLO si se conoce."),
});

export const StorySchema = z.object({
  ...Base,
  template: z.literal("story"),
  hero: z.object({
    kicker: s().describe("Etiqueta corta sobre el titular (ej. 'Piel · Considerada')."),
    title: s().describe("Titular grande en pocas palabras."),
    text: s(),
    primaryCta: s("Agendar"),
    secondaryCta: s("Ver colección"),
    trust: z.array(z.object({ icon, text: s() })).catch([]).describe("Hasta 3 sellos reales con ícono."),
  }),
  ritual: z.object({
    title: s("El ritual empieza."),
    text: s(),
    link: s("Conoce la fórmula"),
    benefits: z.array(z.object({ title: s(), text: s() })).catch([]).describe("3 beneficios reales."),
    spec: z.array(z.string()).catch([]).describe("2 líneas cortas de ficha (ej. 'Crema reparadora · 50 ml')."),
  }),
  marquee: z.object({
    rows: z.array(z.string()).catch([]).describe("2 frases cortas que se desplazan gigantes."),
    tags: z.array(z.string()).catch([]).describe("Hasta 3 etiquetas reales."),
  }),
  inside: z
    .object({
      title: s("Lo que hay adentro importa."),
      text: s(),
      items: z.array(z.object({ title: s(), text: s() })).catch([]).describe("4 ingredientes o componentes REALES (de la descripción del producto)."),
    })
    .nullable()
    .catch(null)
    .describe("null si no hay datos reales de ingredientes o componentes."),
  collection: z.object({ kicker: s("La colección"), title: s() }),
  items: z.array(StoryItem).catch([]),
  visit: z.object({
    title: s("Tu primera visita."),
    text: s(),
    steps: z.array(z.object({ title: s(), text: s(), meta: sn() })).catch([]).describe("3 pasos reales de la primera compra o visita."),
  }),
  book: z.object({
    title: s("Tu momento empieza aquí."),
    text: s(),
    facts: z.array(z.object({ label: s(), text: s() })).catch([]).describe("Hasta 3 datos reales: precio de valoración, dirección, importante."),
    button: s("Pedir mi cita"),
  }),
  footer: s(),
});
export type StoryContent = z.infer<typeof StorySchema>;

export const TemplateSiteSchema = z.discriminatedUnion("template", [ShowroomSchema, StorySchema]);
export type TemplateSiteContent = z.infer<typeof TemplateSiteSchema>;

export function isTemplateContent(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 3;
}

export function templateForPageType(pageType: string | null | undefined): TemplateKey | null {
  return pageType === "showroom" ? "showroom" : pageType === "historia" ? "story" : null;
}
