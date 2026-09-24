import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, formatDateInZone, formatTimeInZone } from "@/lib/timezone";
import {
  AvailabilitySchema,
  DEFAULT_AVAILABILITY,
  getDayAvailability,
  timeStrToMinutes,
  minutesToTimeStr,
  type Availability,
} from "@/lib/agendaAvailability";

// Server-only agenda logic (touches prisma) — re-exports the pure
// schema/date-math helpers from lib/agendaAvailability.ts so every existing
// server caller (actions.ts, route.ts, proxy.ts, agendaBooking.ts) can keep
// importing everything from "@/lib/agenda" as before. AgendaEditor.tsx (a
// client component) imports agendaAvailability.ts directly instead — this
// file pulls in the `pg` driver via prisma.ts, which breaks the browser
// bundle if a client component reaches it even transitively.
export * from "@/lib/agendaAvailability";

/**
 * Free "HH:mm" slots on `dateStr` — the day's configured range, minus
 * already-booked times, minus times already past when `dateStr` is today.
 * `professionalId` scopes both which hours apply (the caller passes that
 * professional's own `availability`, or the agenda-level one when there are
 * no professionals) and which existing bookings count as "taken" — a slot
 * another professional holds at the same clock time is still free here.
 */
export async function getAvailableSlotsForDate(params: {
  websiteId: string;
  dateStr: string;
  availability: Availability;
  slotMinutes: number;
  timezone: string;
  professionalId?: string | null;
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
    where: {
      websiteId: params.websiteId,
      status: "confirmed",
      professionalId: params.professionalId ?? null,
      startsAt: { gte: dayStart, lte: dayEnd },
    },
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
 * not already taken before inserting, then relies on the DB's own unique
 * constraint (see the comment on the Appointment model in schema.prisma) as
 * the real defense against two people booking the same instant at once (the
 * pre-check alone can't close that race; the constraint can).
 *
 * When the agenda has professionals, `professionalId` is required and hours
 * are validated against that professional's own `availability` instead of
 * the agenda-level one — enforced here, not just left to the caller, so a
 * booking can't slip through against the wrong schedule.
 */
export async function bookAppointment(params: {
  websiteId: string;
  dateStr: string;
  timeStr: string;
  name: string;
  contact: string;
  email?: string | null;
  professionalId?: string | null;
}): Promise<BookAppointmentResult> {
  const config = await prisma.agendaConfig.findUnique({
    where: { websiteId: params.websiteId },
    include: { professionals: { where: { active: true } } },
  });
  if (!config) return { ok: false, error: "Esta página no tiene una agenda configurada." };

  let availabilitySource: unknown = config.availability;
  if (config.professionals.length > 0) {
    const professional = config.professionals.find((p) => p.id === params.professionalId);
    if (!professional) return { ok: false, error: "Elige con quién quieres agendar." };
    availabilitySource = professional.availability;
  }

  const availability = AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(availabilitySource);
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
      data: {
        websiteId: params.websiteId,
        professionalId: config.professionals.length > 0 ? params.professionalId : null,
        name: params.name,
        contact: params.contact,
        email: params.email || null,
        startsAt,
      },
    });
    return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ese horario se acaba de reservar, elige otro." };
    }
    throw err;
  }
}
