import type { StyleKey } from "@/lib/websiteContentV2";

// Small visual signature per style for the builder's style gallery — not the
// real page colors (those are chosen per business), just enough to show the
// mood of each design language at a glance.
export const STYLE_SWATCH: Record<StyleKey, { bg: string; text: string; accent: string; surface: string; radius: number; serif: boolean; upper: boolean }> = {
  editorial: { bg: "#f6f3ee", text: "#1d1b18", accent: "#7a5c3e", surface: "#ebe6dd", radius: 2, serif: true, upper: false },
  bold: { bg: "#f2f0e9", text: "#111111", accent: "#ff4d1c", surface: "#e4e1d6", radius: 0, serif: false, upper: true },
  tech: { bg: "#0b1020", text: "#eef1ff", accent: "#7c8cff", surface: "#141a30", radius: 10, serif: false, upper: false },
  clinico: { bg: "#f3f8f7", text: "#12302c", accent: "#1f7a6d", surface: "#e3efec", radius: 14, serif: false, upper: false },
  calido: { bg: "#fbf4ee", text: "#2b1d16", accent: "#c4553a", surface: "#f2e5da", radius: 18, serif: true, upper: false },
  gourmet: { bg: "#1c1512", text: "#f6ebde", accent: "#e0a24a", surface: "#2a201b", radius: 4, serif: true, upper: false },
  producto: { bg: "#f5f5f3", text: "#151515", accent: "#f06a1d", surface: "#e9e9e6", radius: 16, serif: false, upper: false },
  tienda: { bg: "#ffffff", text: "#111111", accent: "#111111", surface: "#f1f1f1", radius: 12, serif: false, upper: false },
  lanzamiento: { bg: "#06121a", text: "#eafcf7", accent: "#19e3a5", surface: "#0d1f2a", radius: 12, serif: false, upper: false },
  corporativo: { bg: "#f4f6f9", text: "#0f1d33", accent: "#1d4ed8", surface: "#e5eaf2", radius: 6, serif: false, upper: false },
  pop: { bg: "#fff6e9", text: "#2a1846", accent: "#ff3d7f", surface: "#ffe7c7", radius: 22, serif: false, upper: false },
  lujo: { bg: "#0e0d0b", text: "#efe6d4", accent: "#c8a96a", surface: "#1a1814", radius: 2, serif: true, upper: false },
};

// Palette + font pairing applied when the owner picks a style in the
// builder, so switching style visibly changes the page (the AI's own
// colors are kept until then). Colors meet the same contrast rules the
// generator follows: text ≥7:1 and accent ≥4.5:1 on the background.
export const STYLE_THEME: Record<
  StyleKey,
  { primaryColor: string; backgroundColor: string; surfaceColor: string; textColor: string; headingFont: string; bodyFont: string }
> = {
  editorial: { primaryColor: "#7a5c3e", backgroundColor: "#f6f3ee", surfaceColor: "#ebe6dd", textColor: "#1d1b18", headingFont: "Cormorant Garamond", bodyFont: "Manrope" },
  bold: { primaryColor: "#d63a0f", backgroundColor: "#f2f0e9", surfaceColor: "#e4e1d6", textColor: "#111111", headingFont: "Bricolage Grotesque", bodyFont: "Work Sans" },
  tech: { primaryColor: "#8b9bff", backgroundColor: "#0b1020", surfaceColor: "#141a30", textColor: "#eef1ff", headingFont: "Sora", bodyFont: "DM Sans" },
  clinico: { primaryColor: "#1f6f63", backgroundColor: "#f3f8f7", surfaceColor: "#e3efec", textColor: "#12302c", headingFont: "Lora", bodyFont: "Nunito Sans" },
  calido: { primaryColor: "#b4472d", backgroundColor: "#fbf4ee", surfaceColor: "#f2e5da", textColor: "#2b1d16", headingFont: "Fraunces", bodyFont: "DM Sans" },
  gourmet: { primaryColor: "#e0a24a", backgroundColor: "#1c1512", surfaceColor: "#2a201b", textColor: "#f6ebde", headingFont: "Playfair Display", bodyFont: "Outfit" },
  producto: { primaryColor: "#d9480f", backgroundColor: "#f5f5f3", surfaceColor: "#e9e9e6", textColor: "#151515", headingFont: "Plus Jakarta Sans", bodyFont: "Inter" },
  tienda: { primaryColor: "#111111", backgroundColor: "#fafaf8", surfaceColor: "#efefec", textColor: "#121212", headingFont: "Outfit", bodyFont: "DM Sans" },
  lanzamiento: { primaryColor: "#19e3a5", backgroundColor: "#06121a", surfaceColor: "#0d1f2a", textColor: "#eafcf7", headingFont: "Sora", bodyFont: "DM Sans" },
  corporativo: { primaryColor: "#1d4ed8", backgroundColor: "#f4f6f9", surfaceColor: "#e5eaf2", textColor: "#0f1d33", headingFont: "Manrope", bodyFont: "Inter" },
  pop: { primaryColor: "#d6246a", backgroundColor: "#fff6e9", surfaceColor: "#ffe7c7", textColor: "#2a1846", headingFont: "Bricolage Grotesque", bodyFont: "Nunito Sans" },
  lujo: { primaryColor: "#c8a96a", backgroundColor: "#0e0d0b", surfaceColor: "#1a1814", textColor: "#efe6d4", headingFont: "Cormorant Garamond", bodyFont: "Manrope" },
};
