import { findTag, normalizeLabel, resolveTags, type TagContext } from "@/lib/templateTags";
import type { Rule, Trigger } from "./flow";

// The small pure rules the flow engine leans on: filling [tags] in a message,
// reading a customer's answer (email, phone, date…), deciding conditions and
// matching what started a flow.

/** What a flow knows about the person it is talking to, at this moment. */
export type LeadView = {
  name: string | null;
  phone: string;
  email: string | null;
  tags: string[];
  stageId: string;
  appointmentAt: Date | null;
  /** The last thing the customer wrote (the reply that is being handled). */
  lastText: string;
  businessName: string;
  agendaUrl: string | null;
  timeZone: string;
  /** Hour of the day (0-23) in the business's time zone, for time-of-day conditions. */
  hour: number;
};

const tagContext = (lead: LeadView): TagContext => ({
  name: lead.name,
  appointmentAt: lead.appointmentAt,
  timeZone: lead.timeZone,
  agendaUrl: lead.agendaUrl,
  businessName: lead.businessName,
});

const BRACKET = /\[([^\[\]\n]{1,40})\]/g;

/**
 * [nombre del lead] → "Ana". Same tags as the templates, plus the phone and
 * e-mail. A tag with nothing to fill it (no appointment yet) disappears
 * instead of leaving a hole in the sentence; any other [text] stays as typed.
 */
export function renderText(text: string, lead: LeadView): string {
  return text.replace(BRACKET, (whole, label: string) => {
    const key = findTag(label);
    if (key) {
      const resolved = resolveTags([key], tagContext(lead));
      return resolved.ok ? resolved.values[0] : "";
    }
    const plain = normalizeLabel(label);
    if (["telefono", "telefono del lead", "celular", "numero"].includes(plain)) return lead.phone;
    if (["correo", "email", "correo del lead", "email del lead"].includes(plain)) return lead.email ?? "";
    return whole;
  });
}

// ---- Reading answers ----

export type Answer = { ok: true; value: string } | { ok: false };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Checks a customer's reply against what a Validation step asked for and returns it in a clean form. */
export function validateAnswer(kind: "email" | "phone" | "number" | "date" | "text", raw: string): Answer {
  const text = raw.trim();
  if (!text) return { ok: false };
  if (kind === "text") return text.length >= 2 ? { ok: true, value: text } : { ok: false };
  if (kind === "email") return EMAIL.test(text) ? { ok: true, value: text.toLowerCase() } : { ok: false };
  if (kind === "phone") {
    const digits = text.replace(/[\s().-]/g, "");
    return /^\+?\d{7,15}$/.test(digits) ? { ok: true, value: digits } : { ok: false };
  }
  if (kind === "number") {
    const n = Number(text.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && /^-?\d+([.,]\d+)?$/.test(text.replace(/\s/g, "")) ? { ok: true, value: String(n) } : { ok: false };
  }
  // date: 25/12/2026, 25-12-2026 or 2026-12-25
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const iso = validDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    return iso ? { ok: true, value: iso } : { ok: false };
  }
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const iso = validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    return iso ? { ok: true, value: iso } : { ok: false };
  }
  return { ok: false };
}

// ---- Conditions ----

const norm = normalizeLabel;

export function evaluateRule(rule: Rule, lead: LeadView): boolean {
  switch (rule.field) {
    case "tag": {
      const has = lead.tags.some((t) => norm(t) === norm(rule.value));
      return rule.op === "has" ? has : !has;
    }
    case "stage":
      return rule.op === "is" ? lead.stageId === rule.value : lead.stageId !== rule.value;
    case "message": {
      const text = norm(lead.lastText);
      const wanted = norm(rule.value);
      if (rule.op === "equals") return text === wanted;
      return rule.op === "contains" ? text.includes(wanted) : !text.includes(wanted);
    }
    case "hour":
      return rule.op === "gte" ? lead.hour >= rule.value : lead.hour <= rule.value;
    case "appointment":
      return rule.op === "exists" ? lead.appointmentAt != null : lead.appointmentAt == null;
    case "email":
      return rule.op === "exists" ? !!lead.email?.trim() : !lead.email?.trim();
    case "name":
      return rule.op === "exists" ? !!lead.name?.trim() : !lead.name?.trim();
  }
}

export function evaluateRules(match: "all" | "any", rules: Rule[], lead: LeadView): boolean {
  return match === "all" ? rules.every((r) => evaluateRule(r, lead)) : rules.some((r) => evaluateRule(r, lead));
}

// ---- What starts a flow ----

export type FlowEvent =
  | { type: "new_conversation" }
  | { type: "message"; text: string }
  | { type: "stage_changed"; stageId: string }
  | { type: "tag_added"; tag: string }
  | { type: "appointment_booked" };

/** Lower-case, no accents, punctuation as spaces: "¡Hola, QUIERO info!" → " hola quiero info ". */
const words = (text: string) => ` ${norm(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

export function matchesTrigger(trigger: Trigger, event: FlowEvent): boolean {
  if (trigger.type !== event.type) return false;
  switch (trigger.type) {
    case "new_conversation":
    case "appointment_booked":
      return true;
    case "message": {
      const text = words((event as { text: string }).text);
      return trigger.keywords.some((k) => (trigger.match === "exact" ? text === words(k) : text.includes(words(k))));
    }
    case "stage_changed":
      return trigger.stageId === (event as { stageId: string }).stageId;
    case "tag_added":
      return norm(trigger.tag) === norm((event as { tag: string }).tag);
  }
}

/** The text a customer's reply is matched with: a button or list title, or the id Meta reports for it. */
export function matchesChoice(choice: { id: string; title: string }, reply: { text: string; replyId?: string }): boolean {
  return (!!reply.replyId && reply.replyId === choice.id) || norm(reply.text) === norm(choice.title);
}
