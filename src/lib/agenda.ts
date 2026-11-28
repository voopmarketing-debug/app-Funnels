import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedTimeToUtc, formatDateInZone, formatTimeInZone } from "@/lib/timezone";
import { freeStarts, overlapsAny, type BusyRange } from "@/lib/agendaSlots";
import { parseServices } from "@/lib/agendaServices";
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
  // How long the appointment being booked lasts (a service's length); defaults to one slot.
  duration?: number;
}): Promise<string[]> {
  const day = getDayAvailability(params.availability, params.dateStr);
  if (!day.enabled) return [];

  const duration = params.duration ?? params.slotMinutes;
  const dayStart = zonedTimeToUtc(params.dateStr, "00:00", params.timezone);
  const dayEnd = zonedTimeToUtc(params.dateStr, "23:59", params.timezone);
  const booked = await prisma.appointment.findMany({
    where: {
      websiteId: params.websiteId,
      status: "confirmed",
      professionalId: params.professionalId ?? null,
      startsAt: { gte: dayStart, lte: dayEnd },
    },
    select: { startsAt: true, durationMinutes: true },
  });
  const busy: BusyRange[] = booked.map((b) => {
    const start = timeStrToMinutes(formatTimeInZone(b.startsAt, params.timezone));
    return { start, end: start + (b.durationMinutes ?? params.slotMinutes) };
  });

  const todayStr = formatDateInZone(new Date(), params.timezone);
  const isToday = params.dateStr === todayStr;
  return freeStarts({
    startMin: timeStrToMinutes(day.start),
    endMin: timeStrToMinutes(day.end),
    gridMinutes: params.slotMinutes,
    duration,
    busy,
    notBefore: isToday ? timeStrToMinutes(formatTimeInZone(new Date(), params.timezone)) : undefined,
  }).map(minutesToTimeStr);
}

/** Union of every given professional's own free slots on `dateStr` — a time is offered if AT LEAST ONE of them is free then, for the "no preference" picker option. */
export async function getAvailableSlotsForAnyProfessional(params: {
  websiteId: string;
  dateStr: string;
  professionals: { id: string; availability: unknown }[];
  slotMinutes: number;
  timezone: string;
  duration?: number;
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
        duration: params.duration,
      }),
    ),
  );
  const union = new Set<string>();
  for (const slots of perProfessional) for (const t of slots) union.add(t);
  return Array.from(union).sort();
}

export type BookAppointmentResult =
  | { ok: true; appointmentId: string; startsAt: Date; professionalId: string | null; service: string | null; durationMinutes: number }
  | { ok: false; error: string };

/** Whether `startsAt` is on the agenda's grid and the whole appointment fits inside this day's opening hours. */
function isWithinOwnHours(availability: Availability, dateStr: string, timeStr: string, slotMinutes: number, duration: number = slotMinutes): boolean {
  const day = getDayAvailability(availability, dateStr);
  const requestedMin = timeStrToMinutes(timeStr);
  const startMin = timeStrToMinutes(day.start);
  const endMin = timeStrToMinutes(day.end);
  const alignedToSlot = (requestedMin - startMin) % slotMinutes === 0;
  return day.enabled && requestedMin >= startMin && requestedMin + duration <= endMin && alignedToSlot;
}

type ProfessionalRow = { id: string; name: string; availability: unknown };
type Tx = Prisma.TransactionClient;

// Longest an appointment can last (agendaServices.ts), to know how far back to look for one that overlaps.
const LONGEST_APPOINTMENT_MS = 480 * 60 * 1000;

/** Whether this professional (or the whole agenda when null) already has a confirmed booking overlapping [startsAt, endsAt). */
async function hasConflict(tx: Tx, websiteId: string, professionalId: string | null, startsAt: Date, endsAt: Date, slotMinutes: number): Promise<boolean> {
  const nearby = await tx.appointment.findMany({
    where: { websiteId, status: "confirmed", professionalId, startsAt: { gte: new Date(startsAt.getTime() - LONGEST_APPOINTMENT_MS), lt: endsAt } },
    select: { startsAt: true, durationMinutes: true },
  });
  const range: BusyRange[] = nearby.map((a) => {
    const start = (a.startsAt.getTime() - startsAt.getTime()) / 60000;
    return { start, end: start + (a.durationMinutes ?? slotMinutes) };
  });
  return overlapsAny(range, 0, (endsAt.getTime() - startsAt.getTime()) / 60000);
}

/**
 * Picks who actually gets a "no preference" booking, among those free for the whole appointment:
 * whoever has the fewest upcoming confirmed appointments (load-balanced), ties broken randomly.
 */
async function assignAnyProfessional(
  tx: Tx,
  params: { websiteId: string; professionals: ProfessionalRow[]; dateStr: string; timeStr: string; slotMinutes: number; duration: number; startsAt: Date; endsAt: Date },
): Promise<ProfessionalRow | null> {
  const inHours = params.professionals.filter((p) =>
    isWithinOwnHours(AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(p.availability), params.dateStr, params.timeStr, params.slotMinutes, params.duration),
  );
  const free: ProfessionalRow[] = [];
  for (const p of inHours) {
    if (!(await hasConflict(tx, params.websiteId, p.id, params.startsAt, params.endsAt, params.slotMinutes))) free.push(p);
  }
  if (free.length === 0) return null;

  const counts = await tx.appointment.groupBy({
    by: ["professionalId"],
    where: { websiteId: params.websiteId, status: "confirmed", professionalId: { in: free.map((p) => p.id) }, startsAt: { gte: new Date() } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.professionalId as string, c._count._all]));
  const minCount = Math.min(...free.map((p) => countById.get(p.id) ?? 0));
  const leastBusy = free.filter((p) => (countById.get(p.id) ?? 0) === minCount);
  return leastBusy[Math.floor(Math.random() * leastBusy.length)];
}

/**
 * Books one appointment. It re-validates everything on the server (the service, the opening hours of
 * the chosen professional, the whole duration free) and does the check and the insert under a lock on
 * the agenda, so two people booking overlapping times at once can never both get it. The DB's unique
 * constraint on the exact start stays as a second guard.
 *
 * When the agenda has professionals, `professionalId` is required: a real one, or ANY_PROFESSIONAL_ID
 * ("no preference"), which picks whoever is free and least busy. When it has services, `serviceId` is
 * required and sets the duration; without services every appointment is one slot.
 */
export async function bookAppointment(params: {
  websiteId: string;
  dateStr: string;
  timeStr: string;
  name: string;
  contact: string;
  email?: string | null;
  professionalId?: string | null;
  serviceId?: string | null;
  note?: string | null;
  // Answers to the owner's own form fields.
  answers?: { label: string; value: string }[];
}): Promise<BookAppointmentResult> {
  const config = await prisma.agendaConfig.findUnique({
    where: { websiteId: params.websiteId },
    include: { professionals: { where: { active: true }, orderBy: { position: "asc" } } },
  });
  if (!config) return { ok: false, error: "Esta página no tiene una agenda configurada." };

  const services = parseServices(config.services);
  const service = services.length > 0 ? (services.find((x) => x.id === params.serviceId) ?? null) : null;
  if (services.length > 0 && !service) return { ok: false, error: "Elige qué servicio quieres." };
  const duration = service?.minutes ?? config.slotMinutes;

  const startsAt = zonedTimeToUtc(params.dateStr, params.timeStr, config.timezone);
  const endsAt = new Date(startsAt.getTime() + duration * 60000);
  if (startsAt.getTime() <= Date.now()) return { ok: false, error: "Ese horario ya pasó, elige otro." };

  const taken = { ok: false as const, error: "Ese horario se acaba de reservar, elige otro." };
  try {
    return await prisma.$transaction(async (tx): Promise<BookAppointmentResult> => {
      // One booking at a time per agenda: the check below and the insert are then atomic.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agenda:${params.websiteId}`}))`;

      let professionalId: string | null = null;
      let availabilitySource: unknown = config.availability;
      if (config.professionals.length > 0) {
        if (params.professionalId === ANY_PROFESSIONAL_ID) {
          const assigned = await assignAnyProfessional(tx, {
            websiteId: params.websiteId,
            professionals: config.professionals,
            dateStr: params.dateStr,
            timeStr: params.timeStr,
            slotMinutes: config.slotMinutes,
            duration,
            startsAt,
            endsAt,
          });
          if (!assigned) return taken;
          professionalId = assigned.id;
          availabilitySource = assigned.availability;
        } else {
          const professional = config.professionals.find((p) => p.id === params.professionalId);
          if (!professional) return { ok: false, error: "Elige con quién quieres agendar." };
          professionalId = professional.id;
          availabilitySource = professional.availability;
        }
      }

      const availability = AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(availabilitySource);
      if (!isWithinOwnHours(availability, params.dateStr, params.timeStr, config.slotMinutes, duration)) return { ok: false, error: "Ese horario no está disponible." };
      if (await hasConflict(tx, params.websiteId, professionalId, startsAt, endsAt, config.slotMinutes)) return taken;

      const appointment = await tx.appointment.create({
        data: {
          websiteId: params.websiteId,
          professionalId,
          name: params.name,
          contact: params.contact,
          email: params.email || null,
          startsAt,
          service: service?.name ?? null,
          note: params.note?.trim().slice(0, 500) || null,
          answers: params.answers && params.answers.length > 0 ? params.answers : undefined,
          durationMinutes: duration,
        },
      });
      return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt, professionalId, service: service?.name ?? null, durationMinutes: duration };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return taken;
    throw err;
  }
}
