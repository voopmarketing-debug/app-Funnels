import { SECTION_LABELS, WebsiteContentV2Schema, type Section, type SectionType, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { mergeLook, type LookPatch } from "@/lib/websiteLook";

// The builder's block operations: add a block from the library, duplicate,
// delete, move, restyle. Pure functions over the page content; the server
// action only loads the page, applies one of these and saves the result.
// The portada (index 0) always stays first and can't be removed.

export const MAX_SECTIONS = 30;

export type BlockEntry = { type: Exclude<SectionType, "hero">; label: string; help: string; group: "texto" | "venta" | "confianza" | "captura" };

/** What the "Agregar bloque" library offers, in the order it shows them. */
export const BLOCK_LIBRARY: BlockEntry[] = [
  { type: "features", label: SECTION_LABELS.features, help: "Tarjetas con ícono: lo que ofreces o por qué elegirte.", group: "texto" },
  { type: "steps", label: SECTION_LABELS.steps, help: "Pasos numerados para explicar cómo trabajas.", group: "texto" },
  { type: "host", label: SECTION_LABELS.host, help: "Foto y presentación de ti o de tu negocio.", group: "texto" },
  { type: "gallery", label: SECTION_LABELS.gallery, help: "Rejilla con tus fotos más recientes.", group: "texto" },
  { type: "productGrid", label: SECTION_LABELS.productGrid, help: "Tus productos con precio y botón de pedido.", group: "venta" },
  { type: "productSpotlight", label: SECTION_LABELS.productSpotlight, help: "Un producto protagonista con detalles.", group: "venta" },
  { type: "promo", label: SECTION_LABELS.promo, help: "Franja de color con un mensaje y un botón.", group: "venta" },
  { type: "comparison", label: SECTION_LABELS.comparison, help: "Tabla: tú frente a las otras opciones.", group: "venta" },
  { type: "trustBar", label: SECTION_LABELS.trustBar, help: "Garantías cortas con ícono.", group: "confianza" },
  { type: "stats", label: SECTION_LABELS.stats, help: "Cifras grandes (solo si son reales).", group: "confianza" },
  { type: "objections", label: SECTION_LABELS.objections, help: "Preguntas frecuentes que se abren y cierran.", group: "confianza" },
  { type: "agenda", label: SECTION_LABELS.agenda, help: "Programa o calendario de un evento.", group: "captura" },
  { type: "leadForm", label: SECTION_LABELS.leadForm, help: "Formulario para que te dejen sus datos.", group: "captura" },
  { type: "cta", label: SECTION_LABELS.cta, help: "Llamado final con un botón grande.", group: "captura" },
];

export const GROUP_LABELS: Record<BlockEntry["group"], string> = { texto: "Contenido", venta: "Ventas", confianza: "Confianza", captura: "Contacto" };

/** A new block with text the owner replaces by clicking on it. */
export function newSection(type: Exclude<SectionType, "hero">, ctx: { firstProductId?: string | null } = {}): Section | null {
  const item = (title: string, description: string) => ({ title, description });
  const icon = (name: "check" | "shield" | "clock" | "heart" | "star" | "chat" | "bolt") => name;
  switch (type) {
    case "features":
      return { type, variant: "cards", kicker: "Lo que ofrecemos", heading: "Escribe aquí tu título", intro: null, items: [
        { icon: icon("check"), ...item("Primer beneficio", "Cuéntale al cliente qué gana con esto.") },
        { icon: icon("heart"), ...item("Segundo beneficio", "Una frase corta y concreta.") },
        { icon: icon("bolt"), ...item("Tercer beneficio", "Evita frases generales: da un dato real.") },
      ] };
    case "steps":
      return { type, kicker: "Cómo funciona", heading: "Así de fácil es empezar", items: [item("Escríbenos", "Cuéntanos qué necesitas."), item("Te asesoramos", "Te respondemos con una propuesta."), item("Listo", "Recibes lo que acordamos.")] };
    case "host":
      return { type, kicker: "Quién te acompaña", heading: "Conoce a quién está detrás", name: "Tu nombre", role: "Tu cargo o especialidad", body: "Presenta aquí a la persona o al negocio: de dónde viene, qué lo hace diferente y por qué confiar." };
    case "gallery":
      return { type, kicker: null, heading: "Mira nuestro trabajo" };
    case "productGrid":
      return { type, variant: "grid", kicker: "Catálogo", heading: "Nuestros productos", productIds: [], showCategoryFilter: false };
    case "productSpotlight":
      return ctx.firstProductId ? { type, productId: ctx.firstProductId, heading: "Por qué te va a encantar", bullets: [{ icon: icon("star"), ...item("Primer detalle", "Lo mejor de este producto.") }, { icon: icon("shield"), ...item("Segundo detalle", "Otra razón para elegirlo.") }], specs: [] } : null;
    case "promo":
      return { type, tone: "accent", kicker: null, heading: "Tu mensaje destacado", body: "Cuéntale al cliente por qué debe escribirte hoy.", ctaLabel: "Escríbenos" };
    case "comparison":
      return { type, heading: "Por qué elegirnos", usLabel: "Nosotros", othersLabel: "Lo típico", rows: [
        { label: "Atención", us: "Directa por WhatsApp", others: "Formularios y esperas" },
        { label: "Respuesta", us: "Rápida", others: "Lenta" },
        { label: "Trato", us: "Personalizado", others: "Genérico" },
      ] };
    case "trustBar":
      return { type, items: [{ icon: icon("chat"), ...item("Atención por WhatsApp", "Te respondemos directo.") }, { icon: icon("clock"), ...item("Respuesta rápida", "Sin esperas largas.") }, { icon: icon("shield"), ...item("Sin compromiso", "Pregunta lo que necesites.") }] };
    case "stats":
      return { type, items: [{ value: "00", label: "Escribe qué mide esta cifra" }, { value: "00", label: "Escribe qué mide esta cifra" }, { value: "00", label: "Escribe qué mide esta cifra" }] };
    case "objections":
      return { type, kicker: "Preguntas frecuentes", heading: "Resolvemos tus dudas", items: [
        { question: "¿Primera pregunta de tus clientes?", answer: "Responde con claridad y en pocas palabras." },
        { question: "¿Segunda pregunta?", answer: "Empieza con sí, no o depende, y da la razón." },
        { question: "¿Tercera pregunta?", answer: "Quita el miedo que frena la compra." },
      ] };
    case "agenda":
      return { type, kicker: "Programa", heading: "Qué vamos a ver", items: [{ when: "Fecha y hora", title: "Primer momento", description: "De qué trata." }, { when: "Fecha y hora", title: "Segundo momento", description: "De qué trata." }] };
    case "leadForm":
      return { type, kicker: null, heading: "Déjanos tus datos", body: "Te escribimos pronto. Sin compromiso.", buttonLabel: "Quiero que me contacten" };
    case "cta":
      return { type, heading: "¿Hablamos hoy?", body: "Escríbenos por WhatsApp y te respondemos al momento.", ctaLabel: "Escribir por WhatsApp" };
  }
}

export type BlockOp =
  | { kind: "add"; type: Exclude<SectionType, "hero">; at?: number }
  | { kind: "duplicate"; index: number }
  | { kind: "remove"; index: number }
  | { kind: "move"; from: number; to: number }
  | { kind: "look"; index: number; patch: LookPatch };

export type BlockResult = { ok: true; content: WebsiteContentV2; focus: number } | { ok: false; error: string };

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Rebuilds `hidden` after the sections were reordered: `order[newIndex]` is the old index it came from (-1 for a new one). */
function remapHidden(hidden: number[], order: number[]): number[] {
  const was = new Set(hidden);
  return order.flatMap((from, to) => (from >= 0 && was.has(from) ? [to] : []));
}

export function applyBlockOp(current: WebsiteContentV2, op: BlockOp, ctx: { firstProductId?: string | null } = {}): BlockResult {
  const next = structuredClone(current) as WebsiteContentV2;
  const n = next.sections.length;
  const bad = (error: string): BlockResult => ({ ok: false, error });
  let focus = 0;

  switch (op.kind) {
    case "add": {
      if (n >= MAX_SECTIONS) return bad(`La página ya tiene el máximo de ${MAX_SECTIONS} bloques.`);
      const at = op.at === undefined ? n : op.at;
      if (!isInt(at) || at < 1 || at > n) return bad("No se pudo agregar el bloque ahí.");
      const made = newSection(op.type, ctx);
      if (!made) return bad("Para usar este bloque primero agrega un producto en Productos.");
      const order = [...Array.from({ length: n }, (_, i) => i)];
      order.splice(at, 0, -1);
      next.sections.splice(at, 0, made);
      next.hidden = remapHidden(current.hidden, order);
      focus = at;
      break;
    }
    case "duplicate": {
      if (!isInt(op.index) || op.index < 1 || op.index >= n) return bad("Ese bloque no se puede duplicar.");
      if (n >= MAX_SECTIONS) return bad(`La página ya tiene el máximo de ${MAX_SECTIONS} bloques.`);
      const order = Array.from({ length: n }, (_, i) => i);
      order.splice(op.index + 1, 0, -1);
      next.sections.splice(op.index + 1, 0, structuredClone(next.sections[op.index]));
      next.hidden = remapHidden(current.hidden, order);
      focus = op.index + 1;
      break;
    }
    case "remove": {
      if (!isInt(op.index) || op.index < 1 || op.index >= n) return bad("Ese bloque no se puede eliminar.");
      const order = Array.from({ length: n }, (_, i) => i);
      order.splice(op.index, 1);
      next.sections.splice(op.index, 1);
      next.hidden = remapHidden(current.hidden, order);
      focus = Math.min(op.index, next.sections.length - 1);
      break;
    }
    case "move": {
      const { from, to } = op;
      if (!isInt(from) || !isInt(to) || from < 1 || to < 1 || from >= n || to >= n) return bad("No se pudo mover ese bloque.");
      if (from === to) return { ok: true, content: current, focus: from };
      const order = Array.from({ length: n }, (_, i) => i);
      const [o] = order.splice(from, 1);
      order.splice(to, 0, o);
      const [moved] = next.sections.splice(from, 1);
      next.sections.splice(to, 0, moved);
      next.hidden = remapHidden(current.hidden, order);
      focus = to;
      break;
    }
    case "look": {
      if (!isInt(op.index) || op.index < 0 || op.index >= n) return bad("No se pudo cambiar el estilo de ese bloque.");
      const section = next.sections[op.index];
      const look = mergeLook(section.look, op.patch);
      if (look) section.look = look;
      else delete section.look;
      focus = op.index;
      break;
    }
    default:
      return bad("Acción no reconocida.");
  }
  const parsed = WebsiteContentV2Schema.safeParse(next);
  return parsed.success ? { ok: true, content: parsed.data, focus } : bad("El cambio no es válido.");
}

/**
 * After the AI rewrote the page: gives each section back the owner's own
 * styling (look) and hidden state. Sections are matched by type + heading
 * first, then by position + type, so a rewritten title keeps its style.
 */
export function carryOver(current: WebsiteContentV2, next: WebsiteContentV2): WebsiteContentV2 {
  const heading = (s: Section) => ("heading" in s && typeof s.heading === "string" ? s.heading : "");
  const used = new Set<number>();
  const source = next.sections.map((s, i) => {
    let match = current.sections.findIndex((c, ci) => !used.has(ci) && c.type === s.type && heading(c) === heading(s));
    if (match < 0 && current.sections[i]?.type === s.type && !used.has(i)) match = i;
    if (match >= 0) used.add(match);
    return match;
  });
  const sections = next.sections.map((s, i) => {
    const old = current.sections[source[i]];
    return old?.look && !s.look ? ({ ...s, look: old.look } as Section) : s;
  });
  return { ...next, sections, hidden: remapHidden(current.hidden, source).filter((i) => i > 0) };
}
