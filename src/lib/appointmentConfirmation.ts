import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { lastCustomerMessageAt, sendAppointmentMessage } from "@/lib/appointmentMessaging";

/**
 * The WhatsApp confirmation right after someone books on the business's
 * agenda page: free text inside the 24-hour window, the approved
 * "confirmacion_cita" template outside it. Best effort by design: the booking
 * is already saved and its e-mails already queued, so this never throws and
 * never changes the booking's outcome.
 */
export async function sendBookingConfirmation(appointmentId: string): Promise<void> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
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
    });
    if (!appt) return;
    const { business } = appt.website;
    if (!business.wabaPhoneNumberId || !business.wabaAccessToken || !isSubscriptionActive(business.subscriptionEndsAt)) return;

    const last = await lastCustomerMessageAt(business.id, appt.contact);
    const result = await sendAppointmentMessage({
      kind: "confirmation",
      business,
      to: appt.contact,
      name: appt.name,
      startsAt: appt.startsAt,
      timeZone: appt.website.agendaConfig?.timezone ?? "America/Bogota",
      lastCustomerMessageAt: last.at,
    });

    if (result.ok) {
      if (last.conversationId) {
        await prisma.message.create({ data: { conversationId: last.conversationId, role: "AGENT", content: result.text, whatsappMsgId: result.messageId } });
      }
      return;
    }
    if (result.reason === "NEEDS_TEMPLATE") {
      await prisma.notification.create({
        data: {
          businessId: business.id,
          conversationId: last.conversationId,
          type: "CONFIRMATION_NEEDS_TEMPLATE",
          message: `✅ ${appt.name} agendó una cita, pero no te ha escrito en las últimas 24 h y WhatsApp solo permite confirmarle con una plantilla aprobada. Crea en Plantillas una llamada "confirmacion_cita" y se usará sola.`,
        },
      });
    }
  } catch (err) {
    console.error("[confirmation] booking confirmation failed:", err instanceof Error ? err.message : err);
  }
}
