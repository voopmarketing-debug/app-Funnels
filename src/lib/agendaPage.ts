import type { Prisma } from "@prisma/client";
import {
  ANY_PROFESSIONAL_ID,
  AvailabilitySchema,
  DEFAULT_AVAILABILITY,
  getAvailableSlotsForAnyProfessional,
  getAvailableSlotsForDate,
  getAvailableDatesInMonth,
  shiftMonthStr,
  mergeAvailabilities,
} from "@/lib/agenda";
import { parseServices } from "@/lib/agendaServices";
import { formatDateInZone } from "@/lib/timezone";
import { parseAgendaDraft } from "@/lib/agendaDraft";
import { renderAgendaHtml } from "@/lib/agendaTemplate";

/** What the public pages (the /sitio/<slug> route and custom domains) load for an agenda. */
export const AGENDA_CONFIG_SELECT = {
  notificationEmail: true,
  timezone: true,
  slotMinutes: true,
  availability: true,
  primaryColor: true,
  style: true,
  title: true,
  subtitle: true,
  address: true,
  mapUrl: true,
  logoUrl: true,
  askNote: true,
  services: true,
  professionals: {
    where: { active: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, title: true, photoUrl: true, email: true, availability: true, pipelineId: true },
  },
} satisfies Prisma.AgendaConfigSelect;

export type AgendaConfigForPage = Prisma.AgendaConfigGetPayload<{ select: typeof AGENDA_CONFIG_SELECT }>;

/** The agenda's public page for the step in `query` (service → professional → day → time → details). */
export async function renderAgendaPage(params: {
  websiteId: string;
  businessName: string;
  whatsappNumber: string | null;
  config: AgendaConfigForPage;
  query: URLSearchParams;
  trackingBasePath: string;
  preview: boolean;
}): Promise<{ html: string; booked: boolean }> {
  const { query } = params;
  // The editor's unsaved settings, only in the owner's preview (never for real visitors).
  const draftRaw = params.preview ? query.get("draft") : null;
  const draft = parseAgendaDraft(draftRaw);
  const config = draft
    ? {
        ...params.config,
        style: draft.style ?? params.config.style,
        primaryColor: draft.color ?? params.config.primaryColor,
        title: draft.title ?? params.config.title,
        subtitle: draft.subtitle ?? params.config.subtitle,
        address: draft.address ?? params.config.address,
        mapUrl: draft.mapUrl ?? params.config.mapUrl,
        logoUrl: draft.logoUrl ?? params.config.logoUrl,
        askNote: draft.askNote ?? params.config.askNote,
      }
    : params.config;
  const professionals = config.professionals;
  const services = draft?.services ?? parseServices(config.services);
  const service = services.find((x) => x.id === query.get("service")) ?? null;
  const needsService = services.length > 0 && !service;

  const professionalParam = query.get("professional");
  const selectedProfessional = professionals.find((p) => p.id === professionalParam) ?? null;
  const isAnyProfessional = professionalParam === ANY_PROFESSIONAL_ID;
  const needsProfessionalPick = professionals.length > 0 && !selectedProfessional && !isAnyProfessional;
  const parse = (raw: unknown) => AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(raw);
  const availability = selectedProfessional
    ? parse(selectedProfessional.availability)
    : isAnyProfessional
      ? mergeAvailabilities(professionals.map((p) => parse(p.availability)))
      : parse(config.availability);

  const dateParam = query.get("date");
  const timeStr = query.get("time");
  const confirmedDate = query.get("reservado_fecha");
  const confirmedTime = query.get("reservado_hora");
  const duration = service?.minutes ?? config.slotMinutes;
  const blocked = needsService || needsProfessionalPick;

  // The month on screen: the one asked for, else the month of the chosen/confirmed day, else this month.
  const todayStr = formatDateInZone(new Date(), config.timezone);
  const thisMonth = todayStr.slice(0, 7);
  const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
  const requestedMonth = query.get("month");
  let monthStr = requestedMonth && monthRe.test(requestedMonth) ? requestedMonth : (dateParam ?? confirmedDate ?? todayStr).slice(0, 7);
  if (!monthRe.test(monthStr) || monthStr < thisMonth) monthStr = thisMonth;
  const lastMonth = shiftMonthStr(thisMonth, 4);
  if (monthStr > lastMonth) monthStr = lastMonth;

  const availableDates = blocked ? [] : getAvailableDatesInMonth(availability, monthStr, config.timezone);
  const slotsFor = (d: string) =>
    isAnyProfessional
      ? getAvailableSlotsForAnyProfessional({
          websiteId: params.websiteId,
          dateStr: d,
          professionals: professionals.map((p) => ({ id: p.id, availability: p.availability })),
          slotMinutes: config.slotMinutes,
          timezone: config.timezone,
          duration,
        })
      : getAvailableSlotsForDate({
          websiteId: params.websiteId,
          dateStr: d,
          availability,
          slotMinutes: config.slotMinutes,
          timezone: config.timezone,
          professionalId: selectedProfessional?.id ?? null,
          duration,
        });

  // The page opens on the first day that still has free times (or the one asked for), so the times
  // are visible without an extra click.
  let dateStr: string | null = null;
  let availableSlots: string[] = [];
  if (!blocked) {
    if (confirmedDate) {
      dateStr = confirmedDate;
    } else if (dateParam && availableDates.includes(dateParam)) {
      dateStr = dateParam;
      if (!timeStr) availableSlots = await slotsFor(dateStr);
    } else if (timeStr) {
      dateStr = availableDates[0] ?? null;
    } else {
      for (const d of availableDates.slice(0, 10)) {
        const free = await slotsFor(d);
        if (free.length > 0) {
          dateStr = d;
          availableSlots = free;
          break;
        }
      }
      dateStr ??= availableDates[0] ?? null;
    }
  }

  const html = renderAgendaHtml({
    businessName: params.businessName,
    primaryColor: config.primaryColor,
    trackingBasePath: params.trackingBasePath,
    style: config.style,
    title: config.title,
    subtitle: config.subtitle,
    address: config.address,
    mapUrl: config.mapUrl,
    logoUrl: config.logoUrl,
    whatsapp: params.whatsappNumber,
    askNote: config.askNote,
    services,
    serviceId: service?.id ?? null,
    professionals: professionals.map((p) => ({ id: p.id, name: p.name, title: p.title, photoUrl: p.photoUrl })),
    professionalId: professionalParam,
    slotMinutes: config.slotMinutes,
    monthStr,
    todayStr,
    availableDates,
    prevMonth: monthStr > thisMonth ? shiftMonthStr(monthStr, -1) : null,
    nextMonth: monthStr < lastMonth ? shiftMonthStr(monthStr, 1) : null,
    dateStr,
    availableSlots,
    timeStr,
    confirmed: confirmedDate && confirmedTime ? { dateStr: confirmedDate, timeStr: confirmedTime } : null,
    bookingError: query.get("error"),
    preview: params.preview,
    draftParam: draft ? draftRaw : null,
  });
  return { html, booked: !!(confirmedDate && confirmedTime) };
}
