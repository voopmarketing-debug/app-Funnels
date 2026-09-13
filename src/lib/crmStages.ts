// Seeded once per business when it's created; after that, the business owns
// and can freely rename/add/delete/reorder its own stages.
export const DEFAULT_PIPELINE_STAGE_NAMES = [
  "Nuevo",
  "En conversación",
  "Interesado",
  "Ganado",
  "Perdido",
];

// Tailwind class fragments cycled by column position — kept to the brand's
// existing palette (accent lime, accent-secondary purple, error red) instead
// of introducing new colors, and independent of whatever the business names
// its stages.
const STAGE_COLOR_PALETTE: { dot: string; border: string }[] = [
  { dot: "bg-ink-faint", border: "border-border" },
  { dot: "bg-accent-secondary", border: "border-accent-secondary/50" },
  { dot: "bg-accent", border: "border-accent/50" },
  { dot: "bg-accent", border: "border-accent" },
  { dot: "bg-error", border: "border-error/50" },
];

export function stageStyle(position: number): { dot: string; border: string } {
  return STAGE_COLOR_PALETTE[position % STAGE_COLOR_PALETTE.length];
}
