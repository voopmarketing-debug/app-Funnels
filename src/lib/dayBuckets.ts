// Groups the days of a range into the bars a person can read: one bar per
// day for a month, per week up to half a year, per month beyond that. A year
// of daily bars is 365 slivers; twelve months is a story.

export type BucketUnit = "day" | "week" | "month";
export type DayBucket = { key: string; unit: BucketUnit; from: string; to: string; days: string[] };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function bucketUnitFor(dayCount: number): BucketUnit {
  return dayCount <= 35 ? "day" : dayCount <= 190 ? "week" : "month";
}

/** Monday of the day's week (YYYY-MM-DD, UTC arithmetic). */
function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

export function bucketDays(days: string[], unit: BucketUnit = bucketUnitFor(days.length)): DayBucket[] {
  const out: DayBucket[] = [];
  for (const day of days) {
    const key = unit === "day" ? day : unit === "week" ? weekStart(day) : day.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.key === key) {
      last.days.push(day);
      last.to = day;
    } else {
      out.push({ key, unit, from: day, to: day, days: [day] });
    }
  }
  return out;
}

const parts = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m: m - 1, d };
};

/** Under the bar: "14 oct" or "oct 25". */
export function bucketShortLabel(b: DayBucket): string {
  const { y, m, d } = parts(b.from);
  return b.unit === "month" ? `${MONTHS[m]} ${String(y).slice(2)}` : `${d} ${MONTHS[m]}`;
}

/** In the tooltip and the summary: "14 oct 2026", "semana del 6 al 12 oct", "octubre 2025". */
export function bucketLongLabel(b: DayBucket): string {
  const from = parts(b.from);
  const to = parts(b.to);
  if (b.unit === "month") return `${MONTHS_LONG[from.m]} ${from.y}`;
  if (b.unit === "day") return `${from.d} ${MONTHS[from.m]} ${from.y}`;
  const fromText = from.m === to.m ? `${from.d}` : `${from.d} ${MONTHS[from.m]}`;
  return `semana del ${fromText} al ${to.d} ${MONTHS[to.m]}`;
}

export const UNIT_WORDS: Record<BucketUnit, { singular: string; plural: string; article: string }> = {
  day: { singular: "día", plural: "días", article: "El día" },
  week: { singular: "semana", plural: "semanas", article: "La semana" },
  month: { singular: "mes", plural: "meses", article: "El mes" },
};
