// Pure (no server imports): the looks of the public agenda page, chosen in the editor and drawn by agendaTemplate.ts.
// Every look uses the same layout (month calendar + times); only colors, shapes and fonts change. The accent is the
// owner's own color, so the page can always be recolored.

export const AGENDA_STYLES = ["cielo", "clasico", "oscuro", "suave", "editorial"] as const;
export type AgendaStyle = (typeof AGENDA_STYLES)[number];

export const DEFAULT_AGENDA_STYLE: AgendaStyle = "cielo";

export function isAgendaStyle(v: unknown): v is AgendaStyle {
  return typeof v === "string" && (AGENDA_STYLES as readonly string[]).includes(v);
}

/** A stored value → a look that exists (older pages saved "compacto"; unknown ones fall back to the default). */
export function agendaStyleOrDefault(v: unknown): AgendaStyle {
  return isAgendaStyle(v) ? v : DEFAULT_AGENDA_STYLE;
}

export type AgendaStyleDef = {
  id: AgendaStyle;
  label: string;
  hint: string;
  bodyFont: string;
  headFont: string;
  fontQuery: string;
  // Page ground and card (the accent colors the ground only in "cielo").
  bg: string;
  text: string;
  surface: string;
  border: string;
  radius: number;
  // Roundness of the day buttons (999 = circles).
  dayRadius: number;
  dark: boolean;
};

export const AGENDA_STYLE_DEFS: Record<AgendaStyle, AgendaStyleDef> = {
  cielo: { id: "cielo", label: "Cielo", hint: "Degradado con tu color", bodyFont: "Plus Jakarta Sans", headFont: "Plus Jakarta Sans", fontQuery: "family=Plus+Jakarta+Sans:wght@400;500;600;700;800", bg: "#eef5ff", text: "#0f2342", surface: "#ffffff", border: "#dbe7fb", radius: 26, dayRadius: 999, dark: false },
  clasico: { id: "clasico", label: "Clásico", hint: "Blanco y limpio", bodyFont: "Inter", headFont: "Inter", fontQuery: "family=Inter:wght@400;500;600;700", bg: "#f6f7f9", text: "#0a0a0a", surface: "#ffffff", border: "#e4e4e7", radius: 16, dayRadius: 999, dark: false },
  oscuro: { id: "oscuro", label: "Oscuro", hint: "Elegante, de noche", bodyFont: "Inter", headFont: "Inter", fontQuery: "family=Inter:wght@400;500;600;700", bg: "#0b0b0d", text: "#f4f4f5", surface: "#151518", border: "#2a2a30", radius: 20, dayRadius: 999, dark: true },
  suave: { id: "suave", label: "Suave", hint: "Cálido y redondeado", bodyFont: "DM Sans", headFont: "DM Sans", fontQuery: "family=DM+Sans:wght@400;500;700", bg: "#fbfaf8", text: "#1c1917", surface: "#ffffff", border: "#ece7e1", radius: 28, dayRadius: 999, dark: false },
  editorial: { id: "editorial", label: "Editorial", hint: "Con serif, de revista", bodyFont: "Inter", headFont: "Playfair Display", fontQuery: "family=Inter:wght@400;600&family=Playfair+Display:wght@500;700", bg: "#ffffff", text: "#111111", surface: "#ffffff", border: "#111111", radius: 2, dayRadius: 2, dark: false },
};
