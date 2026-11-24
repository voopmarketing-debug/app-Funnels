import { TemplateSiteSchema, type TemplateSiteContent } from "./content";

// Click-to-edit for Showroom and Scroll Story pages: the preview marks every text with the path of
// its value in the stored content (data-edit="services.cards.1.title"); the browser sends that path
// and the new text. Only plain text fields can change this way (never the template, colors, ids or
// icons), and the result is validated against the page schema.

const TEXT_KEYS = new Set(["title", "text", "kicker", "tag", "label", "value", "meta", "stamp"]);
/** Texts that may be emptied (the element just disappears from the page). */
const OPTIONAL_KEYS = new Set(["text", "kicker", "meta"]);
const MAX_LEN = 400;

export type TemplateTextResult = { ok: true; content: TemplateSiteContent } | { ok: false; error: string };

const bad = (error = "No se pudo editar ese texto. Recarga la vista previa e inténtalo de nuevo."): TemplateTextResult => ({ ok: false, error });

export function setTemplateTextAtPath(current: TemplateSiteContent, path: string, rawValue: string): TemplateTextResult {
  const parts = path.split(".");
  if (parts.length < 2 || parts.length > 5 || parts.some((p) => !/^[a-zA-Z]+$|^\d{1,2}$/.test(p))) return bad();
  const key = parts[parts.length - 1];
  if (!TEXT_KEYS.has(key)) return bad();

  const next = structuredClone(current) as unknown as Record<string, unknown>;
  let node: unknown = next;
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(node)) {
      if (!/^\d+$/.test(part)) return bad();
      node = node[Number(part)];
    } else if (node && typeof node === "object") {
      node = (node as Record<string, unknown>)[part];
    } else return bad();
    if (node === undefined || node === null) return bad();
  }
  if (!node || typeof node !== "object" || Array.isArray(node)) return bad();
  const holder = node as Record<string, unknown>;
  if (typeof holder[key] !== "string" && holder[key] !== null) return bad();

  const text = rawValue.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (!text && !OPTIONAL_KEYS.has(key)) return bad("Este texto no puede quedar vacío.");
  holder[key] = text || (OPTIONAL_KEYS.has(key) ? (holder[key] === null ? null : "") : text);

  const parsed = TemplateSiteSchema.safeParse(next);
  return parsed.success ? { ok: true, content: parsed.data } : bad("Ese texto no es válido.");
}
