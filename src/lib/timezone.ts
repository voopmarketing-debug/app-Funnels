// Converts a wall-clock date+time in an arbitrary IANA timezone (e.g. "a
// clinic in Bogotá opens at 9:00am local time") into the correct UTC
// instant, without a date-math library. Node ships full ICU by default, so
// Intl.DateTimeFormat already knows every zone's real offset (DST
// included) for any given date — this uses the standard round-trip trick:
// guess a UTC instant, ask Intl what wall-clock time that instant shows in
// the target zone, then correct the guess by the difference.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Intl can format midnight as "24" for hour12: false in some engines.
  const shownHour = get("hour") === 24 ? 0 : get("hour");
  const shownAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), shownHour, get("minute"), get("second"));

  return new Date(guess.getTime() + (guess.getTime() - shownAsUtc));
}

/** "YYYY-MM-DD" for `date` as seen in `timeZone` — used to group/compare appointments by the business's own local day. */
export function formatDateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "HH:mm" for `date` as seen in `timeZone`. */
export function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
