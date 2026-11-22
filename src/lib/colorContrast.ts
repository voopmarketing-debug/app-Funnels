// WCAG contrast helpers for the generated pages: the AI sometimes picks a text
// or accent color that is unreadable on its own background (mint text on white),
// so the renderer corrects it instead of trusting it.

function parse(hex: string): [number, number, number] {
  const full = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1, 7);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parse(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #hex colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns `fg` itself when it already reads on `bg` at the given ratio; otherwise the
 * same hue darkened (on a light background) or lightened (on a dark one) step by step
 * until it does, ending in plain black or white if the hue can never get there.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target: [number, number, number] = luminance(bg) > 0.4 ? [10, 10, 10] : [255, 255, 255];
  const base = parse(fg);
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const next = toHex([0, 1, 2].map((i) => base[i] + (target[i] - base[i]) * t) as [number, number, number]);
    if (contrastRatio(next, bg) >= min) return next;
  }
  return toHex(target);
}
