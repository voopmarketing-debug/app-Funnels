import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { lastCustomerMessageAt, sendAppointmentMessage } from "@/lib/appointmentMessaging";

// The reminder the day before. A daily cron (Vercel's own, once a day fits the
// Hobby plan) runs it in the afternoon, Colombia time, and it reminds everyone
// whose appointment falls on the next calendar day in the business's own time
// zone. The "1 hour before" reminder (lib/agendaReminders.ts) is independent.

const HOUR_MS = 60 * 60 * 1000;
// Something booked this recently was just confirmed; the day-before reminder would be the same message again.
const JUST_BOOKED_MS = 3 * HOUR_MS;

/** "2026-10-29" for this instant in that time zone. */
export function localDateKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** True when `startsAt` falls on the calendar day after `now`, in that time zone. */
export function isTomorrow(startsAt: Date, now: Date, timeZone: string): boolean {
  return localDateKey(startsAt, timeZone) === localDateKey(new Date(now.getTime() + 24 * HOUR_MS), timeZone);
}

export type DayBeforeResult = { checked: number; sent: number; needsTemplate: number; failed: number };

export async function runDayBeforeReminders(now: Date = new Date()): Promise<DayBeforeResult> {
  const from = new Date(now.getTime() + 2 * HOUR_MS);
  const to = new Date(now.getTime() + 60 * HOUR_MS); // wide enough for any time zone; isTomorrow() is the real filter
  const result: DayBeforeResult = { checked: 0, sent: 0, needsTemplate: 0, failed: 0 };

  const appointments = await prisma.appointment.findMany({
    where: { status: "confirmed", dayBeforeReminderSentAt: null, startsAt: { gt: from, lte: to }, createdAt: { lt: new Date(now.getTime() - JUST_BOOKED_MS) } },
    select: {
      id: true,
      name: true,
      contact: true,
      startsAt: true,
      website: {
        select: {
          business: { select: { id: true, name: true, wabaPhoneNumberId: true, wabaId: true, wabaAccessToken: true, subscriptionEndsAt: true } },
          agendaConfig: { select: { timezone: true } },
        },
      },
    },
    take: 200,
  });

  for (const appt of appointments) {
    const timeZone = appt.website.agendaConfig?.timezone ?? "America/Bogota";
    if (!isTomorrow(appt.startsAt, now, timeZone)) continue;
    const { business } = appt.website;
    if (!business.wabaPhoneNumberId || !business.wabaAccessToken || !isSubscriptionActive(business.subscriptionEndsAt)) continue;
    result.checked++;
    // Claimed before sending, so two runs at once never remind twice.
    const claim = await prisma.appointment.updateMany({ where: { id: appt.id, dayBeforeReminderSentAt: null }, data: { dayBeforeReminderSentAt: now } });
    if (claim.count === 0) continue;

    const last = await lastCustomerMessageAt(business.id, appt.contact);
    const sent = await sendAppointmentMessage({ kind: "reminder", business, to: appt.contact, name: appt.name, startsAt: appt.startsAt, timeZone, lastCustomerMessageAt: last.at, now });
    if (sent.ok) {
      result.sent++;
      if (last.conversationId) await prisma.message.create({ data: { conversationId: last.conversationId, role: "AGENT", content: sent.text, whatsappMsgId: sent.messageId } });
    } else if (sent.reason === "NEEDS_TEMPLATE") {
      result.needsTemplate++;
      await notifyNeedsTemplate(business.id, last.conversationId, appt.name);
    } else {
      result.failed++;
    }
  }

  // Appointments set on a contact's CRM ficha (by the AI, the team or a booking page).
  const conversations = await prisma.conversation.findMany({
    where: { appointmentAt: { gt: from, lte: to } },
    select: {
      id: true,
      businessId: true,
      customerPhone: true,
      customerName: true,
      appointmentAt: true,
      appointmentDayBeforeFor: true,
      business: { select: { id: true, name: true, wabaPhoneNumberId: true, wabaId: true, wabaAccessToken: true, subscriptionEndsAt: true } },
    },
    take: 200,
  });

  for (const conv of conversations) {
    const at = conv.appointmentAt!;
    if (conv.appointmentDayBeforeFor?.getTime() === at.getTime()) continue;
    if (!isTomorrow(at, now, "America/Bogota")) continue;
    const { business } = conv;
    if (!business.wabaPhoneNumberId || !business.wabaAccessToken || !isSubscriptionActive(business.subscriptionEndsAt)) continue;
    result.checked++;

    const claim = await prisma.conversation.updateMany({
      where: { id: conv.id, appointmentAt: at, OR: [{ appointmentDayBeforeFor: null }, { appointmentDayBeforeFor: { not: at } }] },
      data: { appointmentDayBeforeFor: at },
    });
    if (claim.count === 0) continue;

    // A booking made on the agenda page was handled by the block above.
    const alreadyReminded = await prisma.appointment.findFirst({
      where: { startsAt: at, dayBeforeReminderSentAt: { not: null }, website: { businessId: conv.businessId } },
      select: { contact: true },
    });
    if (alreadyReminded && alreadyReminded.contact.replace(/\D/g, "").endsWith(conv.customerPhone.slice(-10))) continue;

    const lastCustomer = await prisma.message.findFirst({ where: { conversationId: conv.id, role: "CUSTOMER" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const sent = await sendAppointmentMessage({ kind: "reminder", business, to: conv.customerPhone, name: conv.customerName, startsAt: at, timeZone: "America/Bogota", lastCustomerMessageAt: lastCustomer?.createdAt ?? null, now });
    if (sent.ok) {
      result.sent++;
      await prisma.message.create({ data: { conversationId: conv.id, role: "AGENT", content: sent.text, whatsappMsgId: sent.messageId } });
    } else if (sent.reason === "NEEDS_TEMPLATE") {
      result.needsTemplate++;
      await notifyNeedsTemplate(business.id, conv.id, conv.customerName ?? conv.customerPhone);
    } else {
      result.failed++;
    }
  }

  return result;
}

async function notifyNeedsTemplate(businessId: string, conversationId: string | null, who: string): Promise<void> {
  await prisma.notification.create({
    data: {
      businessId,
      conversationId,
      type: "REMINDER_NEEDS_TEMPLATE",
      message: `⏰ ${who} tiene cita mañana, pero no le escribe hace más de 24 h y WhatsApp solo permite recordarle con una plantilla aprobada. Crea en Plantillas una llamada "recordatorio_cita" y se usará sola.`,
    },
  });
}
