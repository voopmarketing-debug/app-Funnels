import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, formatDateInZone, formatTimeInZone } from "@/lib/timezone";
import {
  AvailabilitySchema,
  DEFAULT_AVAILABILITY,
  getDayAvailability,
  timeStrToMinutes,
  minutesToTimeStr,
  ANY_PROFESSIONAL_ID,
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

/** Union of every given professional's own free slots on `dateStr` — a time is offered if AT LEAST ONE of them is free then, for the "no preference" picker option. */
export async function getAvailableSlotsForAnyProfessional(params: {
  websiteId: string;
  dateStr: string;
  professionals: { id: string; availability: unknown }[];
  slotMinutes: number;
  timezone: string;
}): Promise<string[]> {
  const perProfessional = await Promise.all(
    params.professionals.map((p) =>
      getAvailableSlotsForDate({
        websiteId: params.websiteId,
        dateStr: params.dateStr,
        availability: AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(p.availability),
        slotMinutes: params.slotMinutes,
        timezone: params.timezone,
        professionalId: p.id,
      }),
    ),
  );
  const union = new Set<string>();
  for (const slots of perProfessional) for (const t of slots) union.add(t);
  return Array.from(union).sort();
}

export type BookAppointmentResult =
  | { ok: true; appointmentId: string; startsAt: Date; professionalId: string | null }
  | { ok: false; error: string };

/** Which of `candidates` are actually free at `startsAt` — hours-aligned AND not already booked at that exact instant. Shared by the named-professional and "any" booking paths below. */
function isWithinOwnHours(availability: Availability, dateStr: string, timeStr: string, slotMinutes: number): boolean {
  const day = getDayAvailability(availability, dateStr);
  const requestedMin = timeStrToMinutes(timeStr);
  const startMin = timeStrToMinutes(day.start);
  const endMin = timeStrToMinutes(day.end);
  const alignedToSlot = (requestedMin - startMin) % slotMinutes === 0;
  return day.enabled && requestedMin >= startMin && requestedMin + slotMinutes <= endMin && alignedToSlot;
}

type ProfessionalRow = { id: string; name: string; availability: unknown };

/**
 * Picks who actually gets a "no preference" booking, among those free at
 * this exact instant: whoever has the fewest upcoming confirmed
 * appointments (load-balanced, not just whichever sorts first), ties
 * broken randomly so repeat "no preference" bookings don't all pile onto
 * the same runner-up either.
 */
async function assignAnyProfessional(params: {
  websiteId: string;
  professionals: ProfessionalRow[];
  dateStr: string;
  timeStr: string;
  slotMinutes: number;
  startsAt: Date;
}): Promise<ProfessionalRow | null> {
  const inHours = params.professionals.filter((p) =>
    isWithinOwnHours(AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(p.availability), params.dateStr, params.timeStr, params.slotMinutes),
  );
  if (inHours.length === 0) return null;

  const alreadyBooked = await prisma.appointment.findMany({
    where: {
      websiteId: params.websiteId,
      status: "confirmed",
      professionalId: { in: inHours.map((p) => p.id) },
      startsAt: params.startsAt,
    },
    select: { professionalId: true },
  });
  const bookedIds = new Set(alreadyBooked.map((a) => a.professionalId));
  const free = inHours.filter((p) => !bookedIds.has(p.id));
  if (free.length === 0) return null;

  const now = new Date();
  const counts = await prisma.appointment.groupBy({
    by: ["professionalId"],
    where: { websiteId: params.websiteId, status: "confirmed", professionalId: { in: free.map((p) => p.id) }, startsAt: { gte: now } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.professionalId as string, c._count._all]));
  const minCount = Math.min(...free.map((p) => countById.get(p.id) ?? 0));
  const leastBusy = free.filter((p) => (countById.get(p.id) ?? 0) === minCount);
  return leastBusy[Math.floor(Math.random() * leastBusy.length)];
}

/**
 * Books one slot — re-validates it's still within the configured hours and
 * not already taken before inserting, then relies on the DB's own unique
 * constraint (see the comment on the Appointment model in schema.prisma) as
 * the real defense against two people booking the same instant at once (the
 * pre-check alone can't close that race; the constraint can).
 *
 * When the agenda has professionals, `professionalId` is required — either a
 * real one (hours validated against THEIR OWN `availability`, not the
 * agenda-level one) or ANY_PROFESSIONAL_ID ("no preference"), which picks
 * whoever's actually free and least busy — see assignAnyProfessional.
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

  let assignedProfessionalId: string | null = null;
  let availabilitySource: unknown = config.availability;

  if (config.professionals.length > 0) {
    if (params.professionalId === ANY_PROFESSIONAL_ID) {
      const startsAtCandidate = zonedTimeToUtc(params.dateStr, params.timeStr, config.timezone);
      const assigned = await assignAnyProfessional({
        websiteId: params.websiteId,
        professionals: config.professionals,
        dateStr: params.dateStr,
        timeStr: params.timeStr,
        slotMinutes: config.slotMinutes,
        startsAt: startsAtCandidate,
      });
      if (!assigned) return { ok: false, error: "Ese horario se acaba de reservar, elige otro." };
      assignedProfessionalId = assigned.id;
      availabilitySource = assigned.availability;
    } else {
      const professional = config.professionals.find((p) => p.id === params.professionalId);
      if (!professional) return { ok: false, error: "Elige con quién quieres agendar." };
      assignedProfessionalId = professional.id;
      availabilitySource = professional.availability;
    }
  }

  const availability = AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(availabilitySource);
  if (!isWithinOwnHours(availability, params.dateStr, params.timeStr, config.slotMinutes)) {
    return { ok: false, error: "Ese horario no está disponible." };
  }

  const startsAt = zonedTimeToUtc(params.dateStr, params.timeStr, config.timezone);

  try {
    const appointment = await prisma.appointment.create({
      data: {
        websiteId: params.websiteId,
        professionalId: assignedProfessionalId,
        name: params.name,
        contact: params.contact,
        email: params.email || null,
        startsAt,
      },
    });
    return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt, professionalId: assignedProfessionalId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ese horario se acaba de reservar, elige otro." };
    }
    throw err;
  }
}
