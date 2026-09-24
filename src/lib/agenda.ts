import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, formatDateInZone, formatTimeInZone } from "@/lib/timezone";

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
// everywhere else in this file.
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function getDayAvailability(availability: Availability, dateStr: string) {
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return availability[DAY_KEYS[weekday]];
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

/** Free "HH:mm" slots on `dateStr` — the day's configured range, minus already-booked times, minus times already past when `dateStr` is today. */
export async function getAvailableSlotsForDate(params: {
  websiteId: string;
  dateStr: string;
  availability: Availability;
  slotMinutes: number;
  timezone: string;
}): Promise<string[]> {
  const day = getDayAvailability(params.availability, params.dateStr);
  if (!day.enabled) return [];

  const startMin = timeStrToMinutes(day.start);
  const endMin = timeStrToMinutes(day.end);
  const candidates: string[] = [];
  for (let m = startMin; m + params.slotMinutes <= endMin; m += params.slotMinutes) {
    candidates.push(minutesToTimeStr(m));
  }
  if (candidates.length === 0) return [];

  const dayStart = zonedTimeToUtc(params.dateStr, "00:00", params.timezone);
  const dayEnd = zonedTimeToUtc(params.dateStr, "23:59", params.timezone);
  const booked = await prisma.appointment.findMany({
    where: { websiteId: params.websiteId, status: "confirmed", startsAt: { gte: dayStart, lte: dayEnd } },
    select: { startsAt: true },
  });
  const bookedTimes = new Set(booked.map((b) => formatTimeInZone(b.startsAt, params.timezone)));

  const todayStr = formatDateInZone(new Date(), params.timezone);
  const nowTimeStr = formatTimeInZone(new Date(), params.timezone);
  const isToday = params.dateStr === todayStr;

  return candidates.filter((t) => !bookedTimes.has(t) && !(isToday && t <= nowTimeStr));
}

export type BookAppointmentResult =
  | { ok: true; appointmentId: string; startsAt: Date }
  | { ok: false; error: string };

/**
 * Books one slot — re-validates it's still within the configured hours and
 * not already taken before inserting, then relies on the DB's own
 * (websiteId, startsAt) unique constraint as the real defense against two
 * people booking the same instant at once (the pre-check alone can't close
 * that race; the constraint can).
 */
export async function bookAppointment(params: {
  websiteId: string;
  dateStr: string;
  timeStr: string;
  name: string;
  contact: string;
  email?: string | null;
}): Promise<BookAppointmentResult> {
  const config = await prisma.agendaConfig.findUnique({ where: { websiteId: params.websiteId } });
  if (!config) return { ok: false, error: "Esta página no tiene una agenda configurada." };

  const availability = AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(config.availability);
  const day = getDayAvailability(availability, params.dateStr);
  const requestedMin = timeStrToMinutes(params.timeStr);
  const startMin = timeStrToMinutes(day.start);
  const endMin = timeStrToMinutes(day.end);
  const alignedToSlot = (requestedMin - startMin) % config.slotMinutes === 0;

  if (!day.enabled || requestedMin < startMin || requestedMin + config.slotMinutes > endMin || !alignedToSlot) {
    return { ok: false, error: "Ese horario no está disponible." };
  }

  const startsAt = zonedTimeToUtc(params.dateStr, params.timeStr, config.timezone);

  try {
    const appointment = await prisma.appointment.create({
      data: { websiteId: params.websiteId, name: params.name, contact: params.contact, email: params.email || null, startsAt },
    });
    return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ese horario se acaba de reservar, elige otro." };
    }
    throw err;
  }
}
