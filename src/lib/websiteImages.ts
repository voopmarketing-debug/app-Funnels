import type { Section, WebsiteContentV2 } from "@/lib/websiteContentV2";

// "Generar imágenes con IA": fills the empty picture slots of a page with pictures the platform
// creates, at most five per page. Only scenes, objects and soft backgrounds of the business's world:
// never people (team, clients, before/after), so nothing can pass for a real person or a real result.
// The owner replaces any of them with their own photo by tapping it, or removes them all.

export const AI_IMAGES_PER_PAGE = 5;
/** A flat cost guardrail per business, like the monthly cap of AI text changes. */
export const MONTHLY_WEBSITE_IMAGE_LIMIT = 15;

export type ImageKind = "hero" | "ambient";
export type ImageSlot = { index: number; field: "image" | "bgImage"; kind: ImageKind };

/** What each niche's pictures show. Scenes and objects only: never a person. */
const SCENES: Record<string, { hero: string; ambient: string }> = {
  contadores: {
    hero: "un escritorio de oficina contable ordenado con luz natural: calculadora, libreta, laptop y una planta, visto en ángulo",
    ambient: "superficie de escritorio de madera clara con papeles y un bolígrafo, tonos neutros",
  },
  esteticas: {
    hero: "una cabina de estética luminosa y minimalista: camilla con toalla blanca doblada, velas, piedras y una orquídea",
    ambient: "tonos crema y rosa suave, textura de toallas y pétalos",
  },
  odontologos: {
    hero: "un consultorio odontológico moderno y luminoso: sillón blanco, lámpara, superficies impecables, luz natural",
    ambient: "blancos y azules suaves, destellos de luz, aspecto limpio y clínico",
  },
  abogados: {
    hero: "un despacho de abogados sobrio: biblioteca de madera, escritorio con códigos legales y una pluma, luz cálida lateral",
    ambient: "madera oscura y cuero, tonos cálidos y elegantes",
  },
  psicologos: {
    hero: "un consultorio de psicología cálido: sillón cómodo, mesa baja con una taza de té, plantas, luz de ventana, sensación de calma",
    ambient: "tonos tierra suaves, hojas, luz difusa",
  },
  veterinarias: {
    hero: "una clínica veterinaria luminosa: mesa de consulta limpia, estetoscopio, un collar y juguetes sobre madera clara",
    ambient: "tonos verdes y crema suaves, textura de madera clara y hojas",
  },
  gimnasios: {
    hero: "un gimnasio moderno al amanecer: mancuernas ordenadas, barras, suelo de caucho, luz lateral dramática",
    ambient: "textura de caucho y metal con luz lateral, tonos oscuros",
  },
  inmobiliarias: {
    hero: "la sala de un apartamento moderno y luminoso: ventanales, sofá neutro, vista a la ciudad",
    ambient: "arquitectura moderna: fachada de vidrio y luz del atardecer",
  },
};

export type ImageContext = { businessName: string; industryLabel: string; nicheId: string | null };

const NO_PEOPLE = "Fotografía realista de alta calidad, nunca ilustración ni render 3D. Sin personas, sin rostros, sin manos, sin texto, sin logos ni marcas de agua.";

export function imagePrompt(kind: ImageKind, ctx: ImageContext, variation = 0): string {
  const scene = ctx.nicheId ? SCENES[ctx.nicheId] : undefined;
  const subject = scene ? (kind === "hero" ? scene.hero : scene.ambient) : `el mundo de un negocio de ${ctx.industryLabel}: su espacio de trabajo y sus objetos, ordenados y con buena luz`;
  if (kind === "hero") {
    return `Fotografía editorial para la portada de la página web de un negocio de ${ctx.industryLabel}. Muestra ${subject}. Composición horizontal amplia con espacio de aire a un lado para poner texto, luz natural, aspecto premium. ${NO_PEOPLE}`;
  }
  const angle = ["primer plano muy desenfocado", "plano general suave y desenfocado", "detalle abstracto con profundidad de campo muy corta"][variation % 3];
  return `Imagen de fondo para una sección de una página web de un negocio de ${ctx.industryLabel}: ${subject}, ${angle}. Debe funcionar bajo un velo oscuro con texto encima: sin un sujeto principal que compita con el texto, tonos suaves. Composición horizontal. ${NO_PEOPLE}`;
}

const isFilled = (url: string | null | undefined) => !!url && url.trim() !== "";

/** The picture slots still empty, in the order they matter, capped at what is left of the page's five. */
export function planImageSlots(content: WebsiteContentV2, remaining: number = AI_IMAGES_PER_PAGE): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const hidden = new Set(content.hidden ?? []);
  const hero = content.sections[0];
  if (hero && hero.type === "hero" && hero.variant !== "blank" && hero.variant !== "product" && !isFilled(hero.image) && !isFilled(hero.bgImage)) {
    slots.push({ index: 0, field: "image", kind: "hero" });
  }
  // Soft backgrounds behind a few sections, one of each kind first so the page does not repeat itself.
  const order: Section["type"][] = ["cta", "steps", "features", "promo", "objections"];
  for (const type of order) {
    const at = content.sections.findIndex((s, i) => i > 0 && s.type === type && !hidden.has(i) && !isFilled(s.bgImage) && !slots.some((x) => x.index === i));
    if (at >= 0) slots.push({ index: at, field: "bgImage", kind: "ambient" });
  }
  return slots.slice(0, Math.max(0, remaining));
}

/** How many of the page's pictures are AI ones that are still in use. */
export function aiImagesInUse(content: WebsiteContentV2): number {
  const ai = new Set(content.aiImages ?? []);
  if (ai.size === 0) return 0;
  return content.sections.reduce((n, s) => n + (s.image && ai.has(s.image) ? 1 : 0) + (s.bgImage && ai.has(s.bgImage) ? 1 : 0), 0);
}

/** Puts the new pictures on their slots and remembers them as AI ones. */
export function applyGeneratedImages(content: WebsiteContentV2, placed: { slot: ImageSlot; url: string }[]): WebsiteContentV2 {
  if (placed.length === 0) return content;
  const next = structuredClone(content) as WebsiteContentV2;
  for (const { slot, url } of placed) {
    const section = next.sections[slot.index];
    if (section) section[slot.field] = url;
  }
  const inUse = new Set(next.sections.flatMap((s) => [s.image, s.bgImage]).filter((u): u is string => !!u));
  next.aiImages = Array.from(new Set([...(next.aiImages ?? []), ...placed.map((p) => p.url)])).filter((u) => inUse.has(u)).slice(-12);
  return next;
}

/** Takes every AI picture off the page (the owner's own photos stay). */
export function removeAiImages(content: WebsiteContentV2): WebsiteContentV2 {
  const ai = new Set(content.aiImages ?? []);
  const next = structuredClone(content) as WebsiteContentV2;
  for (const s of next.sections) {
    if (s.image && ai.has(s.image)) s.image = null;
    if (s.bgImage && ai.has(s.bgImage)) s.bgImage = null;
  }
  // The list stays so that undo can bring the pictures back.
  return next;
}
