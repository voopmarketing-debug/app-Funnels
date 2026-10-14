import { WebsiteContentV2Schema, type WebsiteContentV2 } from "@/lib/websiteContentV2";

// Click-to-edit in the builder's preview: every editable text carries the path
// of its value in the stored content (data-edit="sections.2.items.1.title").
// The browser sends that path and the new text; nothing else about the page
// can be changed this way: only plain text fields, only ones that already
// hold text, and the result is validated against the page schema.

/** Text fields a person can edit by clicking. Everything structural (type, variant, icon, ids…) is out. */
const TEXT_KEYS = new Set([
  "heading", "subheading", "eyebrow", "kicker", "intro", "body", "name", "role", "title", "description", "question", "answer",
  "value", "label", "ctaLabel", "secondaryCtaLabel", "buttonLabel", "badge", "when", "us", "others", "usLabel", "othersLabel",
]);
/** Lists of items inside a section that hold text. */
const ARRAYS = new Set(["items", "bullets", "rows"]);
/** Fields that may be emptied (the element just disappears from the page). */
const OPTIONAL_KEYS = new Set(["eyebrow", "kicker", "intro", "badge", "secondaryCtaLabel", "role"]);
/** Fields where a line break is part of the text. */
const MULTILINE_KEYS = new Set(["body", "answer", "description", "intro", "subheading"]);

const MAX_LEN = 600;
const MAX_SHORT = 200;

export type TextEditResult = { ok: true; content: WebsiteContentV2 } | { ok: false; error: string };

const isIndex = (s: string | undefined): s is string => !!s && /^\d{1,3}$/.test(s);

function clean(key: string, raw: string): string {
  const multiline = MULTILINE_KEYS.has(key);
  const text = multiline ? raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : raw.replace(/\s+/g, " ");
  return text.trim().slice(0, multiline ? MAX_LEN : MAX_SHORT);
}

export function setTextAtPath(current: WebsiteContentV2, path: string, rawValue: string): TextEditResult {
  const next = structuredClone(current) as WebsiteContentV2;
  const parts = path.split(".");
  const bad = (error = "No se pudo editar ese texto. Recarga la vista previa e inténtalo de nuevo.") => ({ ok: false as const, error });

  // The top announcement bar.
  if (parts.length === 1 && parts[0] === "announcement") {
    const text = clean("announcement", rawValue);
    next.announcement = text || null;
    return finish(next);
  }

  if (parts[0] !== "sections" || !isIndex(parts[1])) return bad();
  const section = next.sections[Number(parts[1])] as unknown as Record<string, unknown> | undefined;
  if (!section) return bad();

  // sections.<i>.<key>
  if (parts.length === 3 && TEXT_KEYS.has(parts[2])) {
    const key = parts[2];
    if (typeof section[key] !== "string") return bad();
    const text = clean(key, rawValue);
    if (!text && !OPTIONAL_KEYS.has(key)) return bad("Este texto no puede quedar vacío.");
    section[key] = text || null;
    // The highlighted words must still be part of the headline.
    if (key === "heading" && typeof section.highlight === "string" && !text.toLowerCase().includes(section.highlight.trim().toLowerCase())) {
      section.highlight = null;
    }
    return finish(next);
  }

  // sections.<i>.chips.<j>
  if (parts.length === 4 && parts[2] === "chips" && isIndex(parts[3]) && Array.isArray(section.chips)) {
    const chips = section.chips as unknown[];
    const at = Number(parts[3]);
    if (typeof chips[at] !== "string") return bad();
    const text = clean("chip", rawValue);
    if (text) chips[at] = text;
    else chips.splice(at, 1);
    return finish(next);
  }

  // sections.<i>.<list>.<j>.<key>
  if (parts.length === 5 && ARRAYS.has(parts[2]) && isIndex(parts[3]) && TEXT_KEYS.has(parts[4])) {
    const list = section[parts[2]];
    const entry = Array.isArray(list) ? (list[Number(parts[3])] as Record<string, unknown> | undefined) : undefined;
    if (!entry || typeof entry[parts[4]] !== "string") return bad();
    const text = clean(parts[4], rawValue);
    if (!text) return bad("Este texto no puede quedar vacío.");
    entry[parts[4]] = text;
    return finish(next);
  }

  return bad();
}

function finish(next: WebsiteContentV2): TextEditResult {
  const parsed = WebsiteContentV2Schema.safeParse(next);
  return parsed.success ? { ok: true, content: parsed.data } : { ok: false, error: "Ese texto no es válido." };
}

export type SectionImageField = "image" | "bgImage";

/** Sets or clears a section's photo. `url` must already be checked against the business's own pictures. */
export function setSectionImage(current: WebsiteContentV2, index: number, field: SectionImageField, url: string | null): WebsiteContentV2 | null {
  if (!Number.isInteger(index) || index < 0 || index >= current.sections.length) return null;
  const next = structuredClone(current) as WebsiteContentV2;
  const section = next.sections[index] as { image?: string | null; bgImage?: string | null };
  if (url) section[field] = url;
  else delete section[field];
  const parsed = WebsiteContentV2Schema.safeParse(next);
  return parsed.success ? parsed.data : null;
}
