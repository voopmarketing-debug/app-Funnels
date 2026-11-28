import { z } from "zod";

// Pure (no server imports): the booking form of an agenda page is a list of fields the owner edits
// (like a form builder). Name and contact always exist; the rest can be changed, hidden or added to.

export const MAX_AGENDA_FIELDS = 14;

export const FIELD_TYPES = ["text", "textarea", "email", "phone", "number", "select", "checkbox", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  email: "Correo",
  phone: "Teléfono",
  number: "Número",
  select: "Lista de opciones",
  checkbox: "Casilla (sí / no)",
  date: "Fecha",
};

// Standard fields live in their own columns of the appointment; the others are kept as answers.
export const STANDARD_KEYS = ["name", "contact", "email", "note"] as const;
export type StandardKey = (typeof STANDARD_KEYS)[number];

export const FieldSchema = z.object({
  id: z.string().min(1).max(40),
  key: z.enum(STANDARD_KEYS).optional().catch(undefined),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1).max(80),
  required: z.boolean().catch(false),
  placeholder: z.string().trim().max(80).optional().catch(undefined),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional().catch(undefined),
});
export type AgendaField = z.infer<typeof FieldSchema>;

export const DEFAULT_FIELDS: AgendaField[] = [
  { id: "name", key: "name", type: "text", label: "Tu nombre", required: true },
  { id: "contact", key: "contact", type: "phone", label: "Tu WhatsApp o teléfono", required: true },
  { id: "email", key: "email", type: "email", label: "Tu correo", required: false },
  { id: "note", key: "note", type: "textarea", label: "Motivo de la cita", required: false },
];

/** What is stored, cleaned: invalid rows dropped, ids and standard keys unique, name and contact always present and required. */
export function parseFields(raw: unknown): AgendaField[] {
  const out: AgendaField[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = FieldSchema.safeParse(item);
      if (!parsed.success) continue;
      const f = { ...parsed.data };
      if (ids.has(f.id) || (f.key && keys.has(f.key))) continue;
      if (f.key === "name") Object.assign(f, { type: "text", required: true });
      if (f.key === "contact") Object.assign(f, { type: "phone", required: true });
      if (f.key === "email") f.type = "email";
      if (f.key === "note") f.type = f.type === "text" ? "text" : "textarea";
      if (f.type === "select") {
        f.options = (f.options ?? []).filter((o, i, a) => a.indexOf(o) === i);
        if (f.options.length === 0) continue;
      } else delete f.options;
      if (!f.placeholder) delete f.placeholder;
      ids.add(f.id);
      if (f.key) keys.add(f.key);
      out.push(f);
      if (out.length >= MAX_AGENDA_FIELDS) break;
    }
  }
  // The booking cannot work without who and how to reach them.
  if (!keys.has("contact")) out.unshift({ ...DEFAULT_FIELDS[1] });
  if (!keys.has("name")) out.unshift({ ...DEFAULT_FIELDS[0] });
  return out;
}

/** The fields a page shows: the owner's list, or the default four when never edited (the old "ask the reason" switch still applies then). */
export function effectiveFields(raw: unknown, askNote = true): AgendaField[] {
  if (Array.isArray(raw) && raw.length > 0) return parseFields(raw);
  return DEFAULT_FIELDS.filter((f) => f.key !== "note" || askNote).map((f) => ({ ...f }));
}

/** The name an <input> carries in the public form: standard fields keep their own name, the rest are "f_<id>". */
export function inputName(f: AgendaField): string {
  return f.key ?? `f_${f.id}`;
}

export type Submission = {
  name: string;
  contact: string;
  email: string;
  note: string;
  answers: { label: string; value: string }[];
};

const LIMITS: Record<FieldType, number> = { text: 200, textarea: 500, email: 180, phone: 120, number: 40, select: 60, checkbox: 3, date: 10 };
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads the submitted form against the field list: checks required fields and shapes, returns what to store, or the first problem in plain Spanish. */
export function collectSubmission(fields: AgendaField[], read: (inputName: string) => string): ({ ok: true } & Submission) | { ok: false; error: string } {
  const sub: Submission = { name: "", contact: "", email: "", note: "", answers: [] };
  for (const f of fields) {
    let value = read(inputName(f)).trim().slice(0, LIMITS[f.type]);
    if (f.type === "checkbox") value = value ? "Sí" : "";
    if (!value) {
      if (f.required) return { ok: false, error: `Falta completar: ${f.label}.` };
      continue;
    }
    if (f.type === "email" && !EMAIL_SHAPE.test(value)) return { ok: false, error: `Revisa el correo (${f.label}).` };
    if (f.type === "number" && !Number.isFinite(Number(value.replace(",", ".")))) return { ok: false, error: `${f.label}: escribe solo números.` };
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: `${f.label}: elige una fecha.` };
    if (f.type === "select" && !(f.options ?? []).includes(value)) return { ok: false, error: `${f.label}: elige una de las opciones.` };
    if (f.key) sub[f.key] = value;
    else sub.answers.push({ label: f.label, value });
  }
  return { ok: true, ...sub };
}

/** What is stored in Appointment.answers, cleaned. */
export function parseAnswers(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is { label: string; value: string } => !!a && typeof a === "object" && typeof (a as { label?: unknown }).label === "string" && typeof (a as { value?: unknown }).value === "string")
    .map((a) => ({ label: a.label.slice(0, 80), value: a.value.slice(0, 500) }));
}
