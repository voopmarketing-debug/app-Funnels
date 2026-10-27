// The buttons of a WhatsApp message template, checked in one place for the
// form (live feedback) and for the server (what actually goes to Meta).
//
// Three kinds, as WhatsApp offers them:
//  - QUICK_REPLY: the customer taps it and that text comes back to the chat as
//    their answer (the AI agent then replies to it);
//  - URL: opens a link;
//  - PHONE_NUMBER: starts a call.
// Up to 3 in total here (Meta allows more, but three is what fits a bubble
// and what people actually use). Meta also requires the quick replies to sit
// together, so they are always put first.

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone: string };

export const MAX_TEMPLATE_BUTTONS = 3;
export const MAX_BUTTON_TEXT = 25;
const MAX_URL_BUTTONS = 2;
const MAX_PHONE_BUTTONS = 1;

export type ButtonsCheck = { ok: true; buttons: TemplateButton[] } | { ok: false; error: string };

const ORDER: Record<TemplateButton["type"], number> = { QUICK_REPLY: 0, URL: 1, PHONE_NUMBER: 2 };

/** "+57 300 123-4567" → "+573001234567", or null when it is not a phone number with its country code. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(compact) ? compact : null;
}

/** Validates what the person filled in and puts the buttons in the order Meta accepts. */
export function normalizeButtons(raw: { type: string; text?: string; url?: string; phone?: string }[]): ButtonsCheck {
  const buttons: TemplateButton[] = [];
  for (const [i, item] of raw.entries()) {
    const n = i + 1;
    const text = (item.text ?? "").trim();
    if (!text) return { ok: false, error: `Al botón ${n} le falta el texto que verá el cliente.` };
    if (text.length > MAX_BUTTON_TEXT) return { ok: false, error: `El texto del botón ${n} es muy largo: máximo ${MAX_BUTTON_TEXT} caracteres.` };

    if (item.type === "QUICK_REPLY") {
      buttons.push({ type: "QUICK_REPLY", text });
    } else if (item.type === "URL") {
      const url = (item.url ?? "").trim();
      if (!url) return { ok: false, error: `Al botón «${text}» le falta el enlace.` };
      if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)) return { ok: false, error: `El enlace del botón «${text}» debe empezar con https:// y ser una dirección completa.` };
      buttons.push({ type: "URL", text, url });
    } else if (item.type === "PHONE_NUMBER") {
      const phone = normalizePhone(item.phone ?? "");
      if (!phone) return { ok: false, error: `El teléfono del botón «${text}» debe llevar el código de país, por ejemplo +57 300 123 4567.` };
      buttons.push({ type: "PHONE_NUMBER", text, phone });
    } else {
      return { ok: false, error: `El botón ${n} no es de un tipo válido.` };
    }
  }

  if (buttons.length > MAX_TEMPLATE_BUTTONS) return { ok: false, error: `Puedes poner hasta ${MAX_TEMPLATE_BUTTONS} botones.` };
  if (buttons.filter((b) => b.type === "URL").length > MAX_URL_BUTTONS) return { ok: false, error: `Solo caben ${MAX_URL_BUTTONS} botones con enlace.` };
  if (buttons.filter((b) => b.type === "PHONE_NUMBER").length > MAX_PHONE_BUTTONS) return { ok: false, error: "Solo cabe 1 botón de llamada." };
  const seen = new Set<string>();
  for (const b of buttons) {
    const key = b.text.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Dos botones dicen «${b.text}»: cada uno debe tener un texto distinto.` };
    seen.add(key);
  }

  // Stable sort: quick replies first, then links, then the call, each group in the order typed.
  buttons.sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  return { ok: true, buttons };
}

/** The Meta API shape of one button. */
export function metaButton(b: TemplateButton): Record<string, string> {
  if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
  if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
  return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone };
}

/** Buttons saved before the other kinds existed carry no "type" variety: read them back safely. */
export function readStoredButtons(value: unknown): TemplateButton[] {
  if (!Array.isArray(value)) return [];
  const out: TemplateButton[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const text = typeof b.text === "string" ? b.text : "";
    if (!text) continue;
    if (b.type === "QUICK_REPLY") out.push({ type: "QUICK_REPLY", text });
    else if (b.type === "PHONE_NUMBER" && typeof b.phone === "string") out.push({ type: "PHONE_NUMBER", text, phone: b.phone });
    else if (typeof b.url === "string") out.push({ type: "URL", text, url: b.url });
  }
  return out;
}
