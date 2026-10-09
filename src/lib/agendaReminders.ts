import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";
import { isSubscriptionActive } from "@/lib/subscription";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// How far ahead an appointment can be and still get picked up. Wider than a
// tight "exactly 60 minutes" window on purpose: this only runs when an
// external scheduler (see app/api/cron/appointment-reminders/route.ts —
// Vercel's own Hobby-plan cron can't fire more than once a day) hits the
// route, typically every 5-10 minutes. reminderSentAt is the real guard
// against sending twice; the window just bounds how early a reminder can
// go out, not how precisely "1 hour" is hit — if a poll or two gets missed,
// the next one still catches it (a bit later than ideal) instead of the
// appointment silently never getting a reminder at all.
const WINDOW_MINUTES = 65;

export type ReminderRunResult = { checked: number; whatsappSent: number; emailSent: number; crmChecked: number; crmSent: number };

/**
 * Sends the "your appointment is coming up" reminder — WhatsApp text to the
 * lead's contact and, if they left one, an email — for every confirmed
 * appointment starting soon that hasn't been reminded yet. Called by the
 * cron route; see the module comment above for why this can't just be a
 * normal Vercel Cron job on the Hobby plan.
 */
export async function runAppointmentReminders(): Promise<ReminderRunResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: { status: "confirmed", reminderSentAt: null, startsAt: { gt: now, lte: cutoff } },
    select: {
      id: true,
      name: true,
      contact: true,
      email: true,
      startsAt: true,
      professional: { select: { name: true } },
      website: {
        select: {
          business: { select: { name: true, wabaPhoneNumberId: true, wabaAccessToken: true } },
          agendaConfig: { select: { timezone: true } },
        },
      },
    },
  });

  let whatsappSent = 0;
  let emailSent = 0;

  for (const appt of appointments) {
    // Claimed before sending, so two runs at once never remind twice.
    const claim = await prisma.appointment.updateMany({ where: { id: appt.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claim.count === 0) continue;
    const timezone = appt.website.agendaConfig?.timezone ?? "America/Bogota";
    const timeStr = appt.startsAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
    const withProfessional = appt.professional ? ` con ${appt.professional.name}` : "";
    const businessName = appt.website.business.name;

    const { wabaPhoneNumberId, wabaAccessToken } = appt.website.business;
    if (wabaPhoneNumberId && wabaAccessToken) {
      try {
        await sendWhatsAppTextMessage({
          phoneNumberId: wabaPhoneNumberId,
          accessToken: decryptSecret(wabaAccessToken),
          to: appt.contact,
          text: `Hola ${appt.name}, te recordamos tu cita${withProfessional} con ${businessName} hoy a las ${timeStr}. ¡Te esperamos!`,
        });
        whatsappSent++;
      } catch (err) {
        // Most common cause: this lead booked straight from the website and
        // never messaged the business's WhatsApp directly, so Meta has no
        // open 24h window to deliver a free-form message in. Not fatal —
        // the email below is the reliable channel either way.
        console.error(`Reminder WhatsApp send failed for appointment ${appt.id}:`, err);
      }
    }

    if (appt.email) {
      await sendEmail({
        to: appt.email,
        subject: `Recordatorio: tu cita con ${businessName} es en 1 hora`,
        html: `
          <p>Te recordamos tu cita${withProfessional} con <strong>${escapeHtml(businessName)}</strong> hoy a las <strong>${escapeHtml(timeStr)}</strong>.</p>
          <p>Si necesitas cambiarla, contáctanos directamente.</p>
        `,
      });
      emailSent++;
    }

    // Claimed above whether or not either send succeeds: by the next run
    // the appointment may already be minutes away, so a retry isn't useful.
  }

  const crm = await runConversationReminders(now, cutoff);
  return { checked: appointments.length, whatsappSent, emailSent, crmChecked: crm.checked, crmSent: crm.sent };
}

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The appointment on a contact's CRM ficha (set by the AI, by the team, or
 * by a booking page) gets a WhatsApp reminder about an hour before. Inside
 * WhatsApp's 24-hour window it's a personal message; outside it, Meta only
 * allows an approved template, so the business's approved template whose
 * name starts with "recordatorio" is used. Without one the business is told
 * once, and the email (if the contact left one) still goes out.
 */
async function runConversationReminders(now: Date, cutoff: Date): Promise<{ checked: number; sent: number }> {
  const due = await prisma.conversation.findMany({
    where: { appointmentAt: { gt: now, lte: cutoff } },
    select: {
      id: true,
      businessId: true,
      customerPhone: true,
      customerName: true,
      customerEmail: true,
      appointmentAt: true,
      appointmentNote: true,
      appointmentReminderFor: true,
      business: { select: { name: true, wabaPhoneNumberId: true, wabaAccessToken: true, subscriptionEndsAt: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const conv of due) {
    const at = conv.appointmentAt!;
    if (conv.appointmentReminderFor?.getTime() === at.getTime()) continue;
    const claim = await prisma.conversation.updateMany({
      where: { id: conv.id, appointmentAt: at, OR: [{ appointmentReminderFor: null }, { appointmentReminderFor: { not: at } }] },
      data: { appointmentReminderFor: at },
    });
    if (claim.count === 0) continue;

    // Booked from a website agenda: that booking's own reminder (above) already went out.
    const alreadyReminded = await prisma.appointment.findFirst({
      where: { startsAt: at, reminderSentAt: { not: null }, website: { businessId: conv.businessId } },
      select: { contact: true },
    });
    if (alreadyReminded && alreadyReminded.contact.replace(/\D/g, "") === conv.customerPhone) continue;

    const { business } = conv;
    if (!business.wabaPhoneNumberId || !business.wabaAccessToken || !isSubscriptionActive(business.subscriptionEndsAt)) continue;

    const timeStr = at.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
    const firstName = conv.customerName?.trim().split(/\s+/)[0];
    const what = conv.appointmentNote ? ` (${conv.appointmentNote})` : "";
    const lastCustomer = await prisma.message.findFirst({
      where: { conversationId: conv.id, role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const insideWindow = !!lastCustomer && now.getTime() - lastCustomer.createdAt.getTime() < WHATSAPP_WINDOW_MS;
    const accessToken = decryptSecret(business.wabaAccessToken);

    try {
      if (insideWindow) {
        const text = `${firstName ? `Hola ${firstName}` : "Hola"} 👋 Te recordamos tu cita con ${business.name} hoy a las ${timeStr}${what}. Si necesitas reprogramarla, respóndenos por aquí.`;
        const { messageId } = await sendWhatsAppTextMessage({ phoneNumberId: business.wabaPhoneNumberId, accessToken, to: conv.customerPhone, text });
        await prisma.message.create({ data: { conversationId: conv.id, role: "AGENT", content: text, whatsappMsgId: messageId } });
        sent++;
      } else {
        const template = await prisma.messageTemplate.findFirst({
          where: { businessId: conv.businessId, status: "APPROVED", name: { startsWith: "recordatorio" } },
          orderBy: { updatedAt: "desc" },
        });
        if (template) {
          const { messageId } = await sendWhatsAppTemplateMessage({
            phoneNumberId: business.wabaPhoneNumberId,
            accessToken,
            to: conv.customerPhone,
            templateName: template.name,
            language: template.language,
            headerImageUrl: template.headerImageUrl ?? undefined,
          });
          await prisma.message.create({ data: { conversationId: conv.id, role: "AGENT", content: template.bodyText, whatsappMsgId: messageId } });
          sent++;
        } else {
          await prisma.notification.create({
            data: {
              businessId: conv.businessId,
              conversationId: conv.id,
              type: "REMINDER_NEEDS_TEMPLATE",
              message: `⏰ ${conv.customerName ?? conv.customerPhone} tiene cita hoy a las ${timeStr}, pero no le escribe hace más de 24 h y WhatsApp solo permite recordarle con una plantilla aprobada. Crea en Plantillas una llamada "recordatorio_cita" y se usará sola.`,
            },
          });
        }
      }
    } catch (err) {
      console.error(`Reminder for conversation ${conv.id} failed:`, err);
    }

    if (conv.customerEmail) {
      await sendEmail({
        to: conv.customerEmail,
        subject: `Recordatorio: tu cita con ${business.name} es en 1 hora`,
        html: `<p>Te recordamos tu cita con <strong>${escapeHtml(business.name)}</strong> hoy a las <strong>${escapeHtml(timeStr)}</strong>${escapeHtml(what)}.</p><p>Si necesitas cambiarla, respóndenos por WhatsApp.</p>`,
      });
    }
  }
  return { checked: due.length, sent };
}

const SWEEP_EVERY_MS = 60 * 1000;
let lastSweep = 0;

/**
 * Cheap trigger from webhook deliveries and dashboard polling, so reminders
 * still go out between scheduler runs. Each reminder is claimed in the
 * database, so overlapping runs never send twice.
 */
export async function maybeRunAppointmentReminders(): Promise<void> {
  if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = Date.now();
  await runAppointmentReminders();
}
