export const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "NUEVO", label: "Nuevo" },
  { value: "EN_CONVERSACION", label: "En conversación" },
  { value: "INTERESADO", label: "Interesado" },
  { value: "GANADO", label: "Ganado" },
  { value: "PERDIDO", label: "Perdido" },
];

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((option) => [option.value, option.label]),
);

// Tailwind class fragments per stage — kept to the brand's existing palette
// (accent lime, accent-secondary purple, error red) instead of introducing
// new colors just for the CRM board.
export const STAGE_STYLES: Record<string, { dot: string; border: string }> = {
  NUEVO: { dot: "bg-ink-faint", border: "border-border" },
  EN_CONVERSACION: { dot: "bg-accent-secondary", border: "border-accent-secondary/50" },
  INTERESADO: { dot: "bg-accent", border: "border-accent/50" },
  GANADO: { dot: "bg-accent", border: "border-accent" },
  PERDIDO: { dot: "bg-error", border: "border-error/50" },
};
