// WhatsApp identifies every contact by the bare international number
// (country code + number, digits only — e.g. "573001234567"), and that's the
// form Conversation.customerPhone is stored and deduped in. Numbers typed by
// hand or coming from a spreadsheet arrive in every other shape ("+57 300
// 123 4567", "300-123-4567", "0057 300…"), so they're normalized here before
// matching or saving; otherwise the same person would end up as two contacts.
export const DEFAULT_COUNTRY_CODE = "57";

/**
 * Returns the WhatsApp-style number, or null when it can't be a real phone.
 * A number without a country code (10 digits or fewer, no "+"/"00" prefix)
 * gets `defaultCountryCode` in front — e.g. a Colombian "3001234567".
 */
export function normalizePhone(raw: string, defaultCountryCode: string = DEFAULT_COUNTRY_CODE): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^0-9]/g, "");
  const hasInternationalPrefix = trimmed.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!hasInternationalPrefix && digits.length <= 10) {
    const cc = defaultCountryCode.replace(/[^0-9]/g, "");
    digits = cc + digits.replace(/^0+/, "");
  }
  // E.164 allows up to 15 digits; anything under 8 isn't a reachable number.
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
