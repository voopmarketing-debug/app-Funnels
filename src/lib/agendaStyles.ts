// Pure (no server imports): the looks of the public agenda page, chosen in the editor and drawn by agendaTemplate.ts.

export const AGENDA_STYLES = ["clasico", "oscuro", "suave", "editorial", "compacto"] as const;
export type AgendaStyle = (typeof AGENDA_STYLES)[number];

export function isAgendaStyle(v: unknown): v is AgendaStyle {
  return typeof v === "string" && (AGENDA_STYLES as readonly string[]).includes(v);
}

export type AgendaStyleDef = {
  id: AgendaStyle;
  label: string;
  // Two words for the picker.
  hint: string;
  // Two side-by-side columns (info on the left) instead of one centered column.
  split: boolean;
  // Google Fonts family names (body, headings).
  bodyFont: string;
  headFont: string;
  fontQuery: string;
  // Colors that do not depend on the business's accent. `soft` = the page's tinted ground uses the accent.
  bg: string;
  text: string;
  surface: string;
  border: string;
  radius: number;
  dark: boolean;
};

export const AGENDA_STYLE_DEFS: Record<AgendaStyle, AgendaStyleDef> = {
  clasico: { id: "clasico", label: "Clásico", hint: "Limpio y claro", split: false, bodyFont: "Inter", headFont: "Inter", fontQuery: "family=Inter:wght@400;600;700", bg: "#ffffff", text: "#0a0a0a", surface: "#ffffff", border: "#e4e4e7", radius: 12, dark: false },
  oscuro: { id: "oscuro", label: "Oscuro", hint: "Elegante, en dos columnas", split: true, bodyFont: "Inter", headFont: "Inter", fontQuery: "family=Inter:wght@400;600;700", bg: "#0b0b0d", text: "#f4f4f5", surface: "#151518", border: "#2a2a30", radius: 14, dark: true },
  suave: { id: "suave", label: "Suave", hint: "Redondeado y cálido", split: false, bodyFont: "DM Sans", headFont: "DM Sans", fontQuery: "family=DM+Sans:wght@400;500;700", bg: "#fbfaf8", text: "#1c1917", surface: "#ffffff", border: "#ece7e1", radius: 22, dark: false },
  editorial: { id: "editorial", label: "Editorial", hint: "Con serif, de revista", split: false, bodyFont: "Inter", headFont: "Playfair Display", fontQuery: "family=Inter:wght@400;600&family=Playfair+Display:wght@500;700", bg: "#ffffff", text: "#111111", surface: "#ffffff", border: "#111111", radius: 2, dark: false },
  compacto: { id: "compacto", label: "Compacto", hint: "Lista, en dos columnas", split: true, bodyFont: "Inter", headFont: "Inter", fontQuery: "family=Inter:wght@400;500;600;700", bg: "#f6f7f9", text: "#111827", surface: "#ffffff", border: "#e5e7eb", radius: 10, dark: false },
};
