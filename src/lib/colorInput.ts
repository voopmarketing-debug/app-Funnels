/**
 * Turns what a person pastes into a color field into a #rrggbb hex, or null.
 * Accepts the formats color pickers and browser extensions copy:
 * "#F3F3EF", "F3F3EF", "#fff", "rgb(243, 243, 239)", "243, 243, 239".
 */
export function parseColorInput(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  const hex = v.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return `#${h}`;
  }
  const rgb = v.match(/^(?:rgba?\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)?$/);
  if (rgb) {
    const parts = rgb.slice(1, 4).map(Number);
    if (parts.some((n) => n > 255)) return null;
    return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}
