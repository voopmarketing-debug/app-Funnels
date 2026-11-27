import type { Prisma } from "@prisma/client";
import {
  ANY_PROFESSIONAL_ID,
  AvailabilitySchema,
  DEFAULT_AVAILABILITY,
  getAvailableSlotsForAnyProfessional,
  getAvailableSlotsForDate,
  getUpcomingAvailableDates,
  mergeAvailabilities,
} from "@/lib/agenda";
import { parseServices } from "@/lib/agendaServices";
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
  const { config, query } = params;
  const professionals = config.professionals;
  const services = parseServices(config.services);
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

  const dateStr = query.get("date");
  const timeStr = query.get("time");
  const confirmedDate = query.get("reservado_fecha");
  const confirmedTime = query.get("reservado_hora");
  const duration = service?.minutes ?? config.slotMinutes;
  const blocked = needsService || needsProfessionalPick;

  const upcomingDates = blocked || dateStr ? [] : getUpcomingAvailableDates(availability, config.timezone, 10);
  const availableSlots =
    blocked || !dateStr || timeStr
      ? []
      : isAnyProfessional
        ? await getAvailableSlotsForAnyProfessional({
            websiteId: params.websiteId,
            dateStr,
            professionals: professionals.map((p) => ({ id: p.id, availability: p.availability })),
            slotMinutes: config.slotMinutes,
            timezone: config.timezone,
            duration,
          })
        : await getAvailableSlotsForDate({
            websiteId: params.websiteId,
            dateStr,
            availability,
            slotMinutes: config.slotMinutes,
            timezone: config.timezone,
            professionalId: selectedProfessional?.id ?? null,
            duration,
          });

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
    upcomingDates,
    dateStr,
    availableSlots,
    timeStr,
    confirmed: confirmedDate && confirmedTime ? { dateStr: confirmedDate, timeStr: confirmedTime } : null,
    bookingError: query.get("error"),
    preview: params.preview,
  });
  return { html, booked: !!(confirmedDate && confirmedTime) };
}
