const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** "573212285151" → "+57 321 228 5151"; other lengths/countries just get a leading "+". */
export function formatPhone(phone: string): string {
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
  return match ? match[0].toUpperCase() : phone.replace(/\D/g, "").slice(-2);
}
