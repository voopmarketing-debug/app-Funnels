import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

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

export type ReminderRunResult = { checked: number; whatsappSent: number; emailSent: number };

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

    // Marked regardless of whether either send actually succeeded — this is
    // a "don't try again" guard, not a delivery receipt; by the time the
    // next poll runs the appointment may already be minutes away or past,
    // so retrying a failed send isn't useful anyway.
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: now } });
  }

  return { checked: appointments.length, whatsappSent, emailSent };
}
