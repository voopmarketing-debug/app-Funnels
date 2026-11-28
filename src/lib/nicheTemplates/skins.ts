import { STYLE_THEME } from "@/lib/websiteStylePreview";
import type { StyleKey } from "@/lib/websiteContentV2";

// What makes a niche look like itself, on top of the twelve visual styles and the twelve arrangements shared by
// all of them: its own accent color and tint, its own typeface, the shape of its buttons, a different order
// of the section layouts and its own drawing. Without this, template N of every niche was the same page with other words.

export type Skin = {
  /** Accent on light styles / on dark styles (a lighter one, so it stays readable). */
  accent: string;
  accentDark: string;
  /** The hue the backgrounds lean toward. */
  tint: string;
  heading: string;
  body: string | null;
  shape: "square" | "soft" | "round";
  /** How many places the layout variants (features, steps, faq…) and the hero are rotated, so niches differ in structure. */
  shift: number;
};

export const SKINS: Record<string, Skin> = {
  contadores: { accent: "#0f766e", accentDark: "#2dd4bf", tint: "#0f766e", heading: "Manrope", body: "Inter", shape: "square", shift: 0 },
  esteticas: { accent: "#b83d6f", accentDark: "#f2a7c6", tint: "#d68ab0", heading: "Cormorant Garamond", body: "Manrope", shape: "round", shift: 1 },
  odontologos: { accent: "#0e7fa8", accentDark: "#38d0f0", tint: "#38bdf8", heading: "Plus Jakarta Sans", body: "Nunito Sans", shape: "soft", shift: 2 },
  abogados: { accent: "#7a1f2b", accentDark: "#d9a94f", tint: "#8a6a3a", heading: "Playfair Display", body: "Work Sans", shape: "square", shift: 3 },
  psicologos: { accent: "#55806b", accentDark: "#a6d6bd", tint: "#8fb5a0", heading: "Fraunces", body: "DM Sans", shape: "round", shift: 4 },
  veterinarias: { accent: "#e2700a", accentDark: "#fdba74", tint: "#fb923c", heading: "Outfit", body: "Nunito Sans", shape: "round", shift: 1 },
  gimnasios: { accent: "#5e8c0a", accentDark: "#c4f23a", tint: "#a3e635", heading: "Bricolage Grotesque", body: "Work Sans", shape: "square", shift: 2 },
  inmobiliarias: { accent: "#a8570b", accentDark: "#fbbf24", tint: "#1e40af", heading: "Sora", body: "Inter", shape: "soft", shift: 3 },
};

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** `a` mixed with `b` by `t` (0..1 of b). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${hex(x[0] + (y[0] - x[0]) * t)}${hex(x[1] + (y[1] - x[1]) * t)}${hex(x[2] + (y[2] - x[2]) * t)}`;
}

const isDark = (h: string) => {
  const [r, g, b] = rgb(h);
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
};

export type NicheTheme = { primaryColor: string; backgroundColor: string; surfaceColor: string; textColor: string; headingFont: string; bodyFont: string };

/** The theme of template style `style` in this niche: the style's own mood, in the niche's colors and type. */
export function nicheTheme(style: StyleKey, nicheId: string): NicheTheme {
  const base = STYLE_THEME[style];
  const skin = SKINS[nicheId];
  if (!skin) return base;
  const dark = isDark(base.backgroundColor);
  return {
    primaryColor: dark ? skin.accentDark : skin.accent,
    backgroundColor: mix(base.backgroundColor, skin.tint, dark ? 0.1 : 0.08),
    surfaceColor: mix(base.surfaceColor, skin.tint, dark ? 0.14 : 0.12),
    textColor: mix(base.textColor, skin.tint, 0.05),
    headingFont: skin.heading,
    bodyFont: skin.body ?? base.bodyFont,
  };
}

/** Moves `variant` `shift` places along `list` (wrapping), so each niche shows a different layout of the same section. */
export function rotate<T extends string>(list: readonly T[], variant: T, shift: number): T {
  const at = list.indexOf(variant);
  return at < 0 ? variant : list[(at + shift) % list.length];
}
