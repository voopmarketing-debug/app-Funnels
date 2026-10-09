// Date ranges for the Redes sociales page: the presets of the date picker
// and the ?desde=&hasta= params, in Colombia time. Shared by the server and
// the picker, so it imports nothing.

export type DayRange = { since: string; until: string }; // inclusive, YYYY-MM-DD

const DAY_MS = 86_400_000;
/** Longest range the page accepts: Meta keeps about two years, and a year of daily data is already a lot of calls. */
export const MAX_RANGE_DAYS = 366;
const OLDEST_DAYS_BACK = 730;

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function todayInColombia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

export function rangeLength(r: DayRange): number {
  return Math.round((Date.parse(`${r.until}T00:00:00Z`) - Date.parse(`${r.since}T00:00:00Z`)) / DAY_MS) + 1;
}

export type RangePreset = { key: string; label: string; range: (today: string) => DayRange };

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

export const RANGE_PRESETS: RangePreset[] = [
  { key: "ayer", label: "Ayer", range: (t) => ({ since: addDays(t, -1), until: addDays(t, -1) }) },
  { key: "7d", label: "Última semana", range: (t) => ({ since: addDays(t, -7), until: addDays(t, -1) }) },
  { key: "mes", label: "Mes actual", range: (t) => ({ since: monthStart(t), until: t }) },
  { key: "30d", label: "Últimos 30 días", range: (t) => ({ since: addDays(t, -30), until: addDays(t, -1) }) },
  {
    key: "mes-pasado",
    label: "Mes pasado",
    range: (t) => {
      const lastOfPrev = addDays(monthStart(t), -1);
      return { since: monthStart(lastOfPrev), until: lastOfPrev };
    },
  },
  { key: "3m", label: "Últimos 3 meses", range: (t) => ({ since: addDays(t, -90), until: addDays(t, -1) }) },
  { key: "6m", label: "Últimos 6 meses", range: (t) => ({ since: addDays(t, -182), until: addDays(t, -1) }) },
  { key: "12m", label: "Últimos 12 meses", range: (t) => ({ since: addDays(t, -365), until: addDays(t, -1) }) },
];

export const DEFAULT_PRESET = "30d";

const isDay = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** The range in the URL, clamped to what Meta can answer; the default preset when it's missing or invalid. */
export function parseRange(params: { desde?: string; hasta?: string }, today = todayInColombia()): DayRange {
  const fallback = RANGE_PRESETS.find((p) => p.key === DEFAULT_PRESET)!.range(today);
  if (!isDay(params.desde) || !isDay(params.hasta)) return fallback;
  let since = params.desde;
  let until = params.hasta < today ? params.hasta : today;
  if (since > until) [since, until] = [until, since];
  const oldest = addDays(today, -OLDEST_DAYS_BACK);
  if (since < oldest) since = oldest;
  if (rangeLength({ since, until }) > MAX_RANGE_DAYS) since = addDays(until, -(MAX_RANGE_DAYS - 1));
  return { since, until };
}

/** The preset a range matches, if any (to highlight it in the picker). */
export function presetFor(range: DayRange, today = todayInColombia()): RangePreset | null {
  return RANGE_PRESETS.find((p) => {
    const r = p.range(today);
    return r.since === range.since && r.until === range.until;
  }) ?? null;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "1 sep 2026", or "1 sep" when `withYear` is false. */
export function dayLabel(day: string, withYear = true): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "1 sep 2026 – 7 sep 2026" (one day: just the day). */
export function rangeLabel(r: DayRange): string {
  return r.since === r.until ? dayLabel(r.since) : `${dayLabel(r.since)} – ${dayLabel(r.until)}`;
}
