// Personalization tags in a template, written like in Kommo: [nombre del lead].
// Meta only knows numbered variables ({{1}}, {{2}}…), so when a template is
// saved each tag becomes the next variable and the list of tags is kept with
// it; when the template is sent, every tag is filled with that person's data.
// Pure on purpose: the template form (a client component) uses it too.

export type TagKey = "nombre" | "nombre_completo" | "fecha" | "hora" | "enlace" | "negocio";

export const TAGS: { key: TagKey; label: string; aliases: string[]; example: string; help: string }[] = [
  { key: "nombre", label: "nombre del lead", aliases: ["nombre", "nombre del lead", "nombre del cliente", "primer nombre"], example: "Ana", help: "El primer nombre de la persona" },
  { key: "nombre_completo", label: "nombre completo", aliases: ["nombre completo"], example: "Ana Pérez", help: "Su nombre completo" },
  { key: "fecha", label: "fecha de la cita", aliases: ["fecha", "fecha de la cita", "dia de la cita", "dia"], example: "lunes 2 de noviembre", help: "El día de su cita" },
  { key: "hora", label: "hora de la cita", aliases: ["hora", "hora de la cita"], example: "3:30 pm", help: "La hora de su cita" },
  { key: "enlace", label: "enlace de agenda", aliases: ["enlace", "enlace de agenda", "enlace de la agenda", "link", "link de agenda"], example: "https://agente.funnelslabs.app/sitio/mi-agenda", help: "El enlace para agendar" },
  { key: "negocio", label: "nombre del negocio", aliases: ["negocio", "nombre del negocio", "empresa", "nombre de la empresa"], example: "Clínica Sol", help: "El nombre de tu negocio" },
];

/** "Nombre del Lead " → "nombre del lead": no accents, no case, single spaces. */
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findTag(label: string): TagKey | null {
  const wanted = normalizeLabel(label);
  return TAGS.find((t) => t.aliases.includes(wanted))?.key ?? null;
}

const tagByKey = (key: TagKey) => TAGS.find((t) => t.key === key)!;
const BRACKET = /\[([^\[\]\n]{1,40})\]/g;

export type ConvertedBody = {
  /** The body as Meta wants it: {{1}}, {{2}}… */
  body: string;
  /** The tag behind each variable, in order. */
  tags: TagKey[];
  /** What Meta's reviewers see for each variable. */
  examples: string[];
  /** Text in [brackets] that is not a known tag: it is sent as written. */
  unrecognized: string[];
};

/** [nombre del lead] → {{1}}. The same tag twice reuses its number; anything else in brackets stays as text. */
export function convertTags(text: string): ConvertedBody {
  const tags: TagKey[] = [];
  const unrecognized: string[] = [];
  const body = text.replace(BRACKET, (whole, label: string) => {
    const key = findTag(label);
    if (!key) {
      if (!unrecognized.includes(whole)) unrecognized.push(whole);
      return whole;
    }
    let index = tags.indexOf(key);
    if (index === -1) index = tags.push(key) - 1;
    return `{{${index + 1}}}`;
  });
  return { body, tags, examples: tags.map((k) => tagByKey(k).example), unrecognized };
}

/** The stored list of tags, or null if the template has none (older ones, or made in WhatsApp Manager). */
export function readStoredTags(value: unknown): TagKey[] | null {
  if (!Array.isArray(value)) return null;
  const keys = value.filter((v): v is TagKey => typeof v === "string" && TAGS.some((t) => t.key === v));
  return keys.length === value.length && keys.length > 0 ? keys : null;
}

/** A saved body shown the way it was written: {{1}} → [nombre del lead]. */
export function bodyWithTags(bodyText: string, tags: TagKey[] | null): string {
  if (!tags) return bodyText;
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n: string) => {
    const key = tags[Number(n) - 1];
    return key ? `[${tagByKey(key).label}]` : whole;
  });
}

/** A saved body with each tag replaced by its example, for the preview. */
export function bodyWithExamples(bodyText: string, tags: TagKey[] | null): string {
  if (!tags) return bodyText;
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n: string) => {
    const key = tags[Number(n) - 1];
    return key ? tagByKey(key).example : whole;
  });
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "";
}

/** "lunes 2 de noviembre" and "3:30 pm", in the business's own time zone. */
export function formatAppointmentWhen(startsAt: Date, timeZone: string): { date: string; time: string } {
  // Intl uses a comma after the weekday and non-breaking spaces in the time; plain text reads better in a message.
  const plain = (text: string) => text.replace(/[  ]/g, " ").replace(",", "");
  const date = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone }).format(startsAt);
  const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone }).format(startsAt);
  // "3:30 pm", not "3:30 p. m.": the dot would double up with the full stop that ends the sentence.
  return { date: plain(date), time: plain(time).replace(/\s?([ap])\.?\s?m\./i, " $1m") };
}

export type TagContext = {
  name?: string | null;
  appointmentAt?: Date | null;
  timeZone?: string;
  agendaUrl?: string | null;
  businessName?: string | null;
};

const MISSING_LABEL: Record<TagKey, string> = {
  nombre: "el nombre",
  nombre_completo: "el nombre",
  fecha: "una cita agendada",
  hora: "una cita agendada",
  enlace: "una página de agenda",
  negocio: "el nombre del negocio",
};

/**
 * The value of every tag for one person, in the template's order. A missing
 * name falls back to "cliente"; a date, hour or link that doesn't exist for
 * this person can't be made up, so that person is reported instead of
 * receiving "Tu cita es el -".
 */
export function resolveTags(tags: TagKey[], ctx: TagContext): { ok: true; values: string[] } | { ok: false; missing: TagKey; reason: string } {
  const zone = ctx.timeZone ?? "America/Bogota";
  const when = ctx.appointmentAt ? formatAppointmentWhen(ctx.appointmentAt, zone) : null;
  const values: string[] = [];
  for (const key of tags) {
    let value: string | null = null;
    if (key === "nombre") value = firstName(ctx.name) || "cliente";
    else if (key === "nombre_completo") value = ctx.name?.trim() || "cliente";
    else if (key === "fecha") value = when?.date ?? null;
    else if (key === "hora") value = when?.time ?? null;
    else if (key === "enlace") value = ctx.agendaUrl || null;
    else if (key === "negocio") value = ctx.businessName?.trim() || null;
    if (!value) return { ok: false, missing: key, reason: `Falta ${MISSING_LABEL[key]}` };
    values.push(value);
  }
  return { ok: true, values };
}
