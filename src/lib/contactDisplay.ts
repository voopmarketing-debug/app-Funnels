const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * WhatsApp usernames (rolled out by Meta in 2026) let a customer hide their
 * phone number: webhooks then identify them only by a business-scoped user
 * ID (BSUID) like "CO.1A2B3C…" — two-letter country code, a dot, then
 * letters/digits. Such a contact has no phone we can show or link to.
 */
export function isBsuid(id: string): boolean {
  return /^[A-Z]{2}\.[A-Za-z0-9]+$/.test(id);
}

/** "573212285151" → "+57 321 228 5151"; other lengths/countries just get a leading "+". */
export function formatPhone(phone: string): string {
  if (isBsuid(phone)) return "Usuario de WhatsApp (número oculto)";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) {
    return `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits ? `+${digits}` : phone;
}

/**
 * The WhatsApp profile name a contact set for themselves is free text — it
 * can be just punctuation or emoji (e.g. ","), which reads as broken UI. Fall
 * back to their formatted phone number whenever the name has no actual
 * letter or digit in it.
 */
export function contactLabel(name: string | null | undefined, phone: string): string {
  const trimmed = name?.trim();
  return trimmed && HAS_LETTER_OR_DIGIT.test(trimmed) ? trimmed : formatPhone(phone);
}

export function contactInitial(name: string | null | undefined, phone: string): string {
  const match = name?.match(/[\p{L}\p{N}]/u);
  if (match) return match[0].toUpperCase();
  return isBsuid(phone) ? "WA" : phone.replace(/\D/g, "").slice(-2);
}
