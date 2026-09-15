// Split out from analytics.ts so client components (the range <select>) can
// import these without pulling in prisma/pg, which only works server-side.
export type DateRangeKey = "today" | "yesterday" | "7d" | "15d" | "30d";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "15d", label: "Últimos 15 días" },
  { key: "30d", label: "Últimos 30 días" },
];

export function isDateRangeKey(value: string): value is DateRangeKey {
  return DATE_RANGE_OPTIONS.some((o) => o.key === value);
}
