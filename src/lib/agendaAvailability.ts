import { z } from "zod";
import { formatDateInZone } from "@/lib/timezone";

// Deliberately zero server dependencies (no prisma import) — this file is
// imported directly by AgendaEditor.tsx, a client component, so anything
// here ends up in the browser bundle. The DB-touching agenda functions
// (getAvailableSlotsForDate, bookAppointment) live in lib/agenda.ts
// instead, which re-exports everything from here for server callers.

const DaySchema = z.object({
  enabled: z.boolean().catch(false),
  start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .catch("09:00"),
  end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .catch("17:00"),
});

// One simple range per day — no split lunch-break ranges in this first
// version. A real limitation for a business that closes midday, but
// documented rather than silently wrong; splitting one day into two
// ranges is a natural follow-up if a client actually needs it.
export const AvailabilitySchema = z.object({
  monday: DaySchema.catch({ enabled: false, start: "09:00", end: "17:00" }),
  tuesday: DaySchema.catch({ enabled: false, start: "09:00", end: "17:00" }),
  wednesday: DaySchema.catch({ enabled: false, start: "09:00", end: "17:00" }),
  thursday: DaySchema.catch({ enabled: false, start: "09:00", end: "17:00" }),
  friday: DaySchema.catch({ enabled: false, start: "09:00", end: "17:00" }),
  saturday: DaySchema.catch({ enabled: false, start: "09:00", end: "13:00" }),
  sunday: DaySchema.catch({ enabled: false, start: "09:00", end: "13:00" }),
});
export type Availability = z.infer<typeof AvailabilitySchema>;

export const DEFAULT_AVAILABILITY: Availability = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "13:00" },
};

// Index-matches JS's own Date.getUTCDay() (0 = Sunday .. 6 = Saturday). A
// "YYYY-MM-DD" string's weekday doesn't depend on timezone — it's just a
// calendar date — so reading it as UTC midnight is safe here even though
// the business's real opening hours are interpreted in their own zone
// everywhere else this gets used.
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function getDayAvailability(availability: Availability, dateStr: string) {
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return availability[DAY_KEYS[weekday]];
}

// "YYYY-MM" month-navigation helpers for the owner's calendar view (see
// AgendaEditor.tsx) — pure date math, no timezone involved: a "month" here
// just names which appointments to fetch, the same way the URL's own
// `?month=` param does.
export function parseMonthStr(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split("-").map(Number);
  return { year, month: month - 1 };
}

export function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthStr(monthStr: string, delta: number): string {
  const { year, month } = parseMonthStr(monthStr);
  const d = new Date(Date.UTC(year, month + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The next `count` calendar dates (from today, business's own timezone) whose weekday has availability enabled at all — a list to show as bookable days, regardless of whether every slot that day is already taken. */
export function getUpcomingAvailableDates(availability: Availability, timezone: string, count: number): string[] {
  const todayStr = formatDateInZone(new Date(), timezone);
  const [y, m, d] = todayStr.split("-").map(Number);
  const dates: string[] = [];
  // Scanning up to 60 calendar days ahead is enough headroom even for a
  // business with only one enabled weekday to find `count` real options.
  for (let i = 0; dates.length < count && i < 60; i++) {
    const candidate = new Date(Date.UTC(y, m - 1, d + i));
    const dateStr = candidate.toISOString().slice(0, 10);
    if (getDayAvailability(availability, dateStr).enabled) dates.push(dateStr);
  }
  return dates;
}
