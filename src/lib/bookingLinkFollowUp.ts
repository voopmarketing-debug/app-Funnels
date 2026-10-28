import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { lastCustomerMessageAt, normalizeRecipientPhone, sendAppointmentMessage } from "@/lib/appointmentMessaging";

// The automatic "link_agendamiento" follow-up: a person who left their phone
// on the business's page and did not book gets the link to the agenda, once.
// Off by default per business (Business.autoBookingLinkEnabled). It runs from
// the same daily cron as the day-before reminders (app/api/cron/appointment-day-before).

const HOUR_MS = 60 * 60 * 1000;
const MIN_AGE_MS = 24 * HOUR_MS; // the lead has had a day to book on their own
const MAX_AGE_MS = 7 * 24 * HOUR_MS; // an old lead is not chased
const MAX_PER_RUN = 30; // a bug can never message hundreds of people at once
const FIRST_HOUR = 9; // local time of the agenda, never earlier or later
const LAST_HOUR = 19;

/** True between 9:00 and 18:59 in that time zone. */
export function isSendingHour(now: Date, timeZone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
  return hour >= FIRST_HOUR && hour < LAST_HOUR;
}

/** The last 10 digits: the same person with or without the country code, spaces or a +. */
export function phoneKey(contact: string): string {
  return contact.replace(/\D/g, "").slice(-10);
}

export type LeadState = {
  /** They already booked (any confirmed appointment with this phone). */
  hasAppointment: boolean;
  /** The CRM record already carries an appointment. */
  ficheHasAppointment: boolean;
  /** They wrote to the business after leaving their data. */
  wroteAfterLead: boolean;
  /** A person on the team has taken the conversation over. */
  needsHuman: boolean;
  /** This phone already got the link (from this or an earlier form entry). */
  alreadySent: boolean;
};

/** Who must NOT get the message: anyone who booked, wrote back, is being handled by a person, or already got it. */
export function shouldSkipLead(state: LeadState): boolean {
  return state.hasAppointment || state.ficheHasAppointment || state.wroteAfterLead || state.needsHuman || state.alreadySent;
}

export type FollowUpResult = { businesses: number; checked: number; sent: number; needsTemplate: number; failed: number };

export async function runBookingLinkFollowUps(now: Date = new Date()): Promise<FollowUpResult> {
  const result: FollowUpResult = { businesses: 0, checked: 0, sent: 0, needsTemplate: 0, failed: 0 };
  const appHost = process.env.APP_HOST ?? "agente.funnelslabs.app";

  const businesses = await prisma.business.findMany({
    where: { autoBookingLinkEnabled: true, wabaPhoneNumberId: { not: null }, wabaAccessToken: { not: null } },
    select: {
      id: true,
      name: true,
      wabaPhoneNumberId: true,
      wabaId: true,
      wabaAccessToken: true,
      subscriptionEndsAt: true,
      websites: { where: { pageType: "agenda" }, orderBy: { id: "asc" }, take: 1, select: { slug: true, agendaConfig: { select: { timezone: true } } } },
    },
    take: 200,
  });

  let budget = MAX_PER_RUN;
  for (const business of businesses) {
    if (budget <= 0) break;
    const agenda = business.websites[0];
    if (!agenda || !isSubscriptionActive(business.subscriptionEndsAt)) continue;
    const timeZone = agenda.agendaConfig?.timezone ?? "America/Bogota";
    if (!isSendingHour(now, timeZone)) continue;
    result.businesses++;
    const url = `https://${appHost}/sitio/${agenda.slug}`;

    const leads = await prisma.websiteLead.findMany({
      where: { website: { businessId: business.id }, bookingLinkSentAt: null, createdAt: { gt: new Date(now.getTime() - MAX_AGE_MS), lte: new Date(now.getTime() - MIN_AGE_MS) } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, name: true, contact: true, createdAt: true },
    });
    if (leads.length === 0) continue;

    // Who booked recently, and who already got the link: loaded once per business.
    const [appointments, sentBefore] = await Promise.all([
      prisma.appointment.findMany({ where: { website: { businessId: business.id }, status: "confirmed", createdAt: { gt: new Date(now.getTime() - 30 * 24 * HOUR_MS) } }, select: { contact: true } }),
      prisma.websiteLead.findMany({ where: { website: { businessId: business.id }, bookingLinkSentAt: { not: null } }, select: { contact: true } }),
    ]);
    const booked = new Set(appointments.map((a) => phoneKey(a.contact)));
    const contacted = new Set(sentBefore.map((l) => phoneKey(l.contact)));

    for (const lead of leads) {
      if (budget <= 0) break;
      const key = phoneKey(lead.contact);
      if (key.length < 7) continue;
      result.checked++;

      const full = normalizeRecipientPhone(lead.contact);
      const bare = full.startsWith("57") && full.length === 12 ? full.slice(2) : full;
      const conversation = await prisma.conversation.findFirst({
        where: { businessId: business.id, customerPhone: { in: [...new Set([full, bare])] } },
        select: { id: true, appointmentAt: true, needsHumanAt: true },
      });
      const wrote = conversation
        ? await prisma.message.findFirst({ where: { conversationId: conversation.id, role: "CUSTOMER", createdAt: { gt: lead.createdAt } }, select: { id: true } })
        : null;

      if (
        shouldSkipLead({
          hasAppointment: booked.has(key),
          ficheHasAppointment: !!conversation?.appointmentAt,
          wroteAfterLead: !!wrote,
          needsHuman: !!conversation?.needsHumanAt,
          alreadySent: contacted.has(key),
        })
      ) {
        continue;
      }

      // Claimed before sending, so two runs at once never message twice.
      const claim = await prisma.websiteLead.updateMany({ where: { id: lead.id, bookingLinkSentAt: null }, data: { bookingLinkSentAt: now } });
      if (claim.count === 0) continue;
      contacted.add(key);

      const last = await lastCustomerMessageAt(business.id, lead.contact);
      const sent = await sendAppointmentMessage({ kind: "link", business, to: lead.contact, name: lead.name, startsAt: now, timeZone, url, lastCustomerMessageAt: last.at, now });
      if (sent.ok) {
        budget--;
        result.sent++;
        if (last.conversationId) {
          await prisma.message.create({ data: { conversationId: last.conversationId, role: "AGENT", content: sent.text, whatsappMsgId: sent.messageId } });
        }
      } else if (sent.reason === "NEEDS_TEMPLATE") {
        // Nothing went out: release the lead for tomorrow, tell the business once a week, and stop for this business.
        await prisma.websiteLead.update({ where: { id: lead.id }, data: { bookingLinkSentAt: null } });
        contacted.delete(key);
        result.needsTemplate++;
        await notifyOnceAWeek(business.id);
        break;
      } else {
        budget--;
        result.failed++;
      }
    }
  }
  return result;
}

async function notifyOnceAWeek(businessId: string): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: { businessId, type: "LINK_NEEDS_TEMPLATE", createdAt: { gt: new Date(Date.now() - 7 * 24 * HOUR_MS) } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.notification.create({
    data: {
      businessId,
      type: "LINK_NEEDS_TEMPLATE",
      message: 'Tienes activado el envío automático del enlace de agenda, pero falta la plantilla aprobada "link_agendamiento" (con {{1}} nombre y {{2}} enlace). Créala en Plantillas y se enviará sola.',
    },
  });
}
