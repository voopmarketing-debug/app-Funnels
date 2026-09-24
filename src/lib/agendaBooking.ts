import { bookAppointment } from "@/lib/agenda";
import { formatDateLabel } from "@/lib/agendaTemplate";
import { sendEmail } from "@/lib/email";
import { buildIcsEvent } from "@/lib/ics";
import { upsertLeadConversation } from "@/lib/crmIntake";

// The name/contact/email fields below come straight from a public,
// unauthenticated form — interpolated raw into an HTML email body, they'd
// be an HTML-injection vector into whatever mail client renders it.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type AgendaBookingOutcome =
  | { ok: true; dateStr: string; timeStr: string; professionalId: string | null }
  | { ok: false; dateStr: string; error: string };

/**
 * Shared by app/sitio/[slug]/reservar/route.ts and proxy.ts's "/reservar"
 * branch (custom domains) — both just forward the submitted FormData and
 * the resolved website/agenda info here. Books the slot (or reports why it
 * couldn't) and, on success, emails both the business owner and the
 * visitor (if they gave an email).
 */
export async function submitAgendaBooking(params: {
  websiteId: string;
  businessName: string;
  notificationEmail: string;
  formData: FormData;
  // Appointment length, minutes — needed only to compute the calendar
  // invite's DTEND (see lib/ics.ts); the caller already has this from
  // AgendaConfig.slotMinutes for the slot-picking step, no extra query.
  slotMinutes: number;
  // Every professional on this agenda (id/name/email) — passed in by the
  // caller (route.ts/proxy.ts, which already fetched this for the picker),
  // so this function doesn't need its own extra query. Which one actually
  // gets the booking isn't known until AFTER bookAppointment returns — the
  // visitor may have requested "no preference" (see ANY_PROFESSIONAL_ID),
  // in which case it picks whoever's least busy — so this list is looked
  // up by the RESULT's professionalId, not the form's requested one.
  professionals: { id: string; name: string; email: string | null }[];
}): Promise<AgendaBookingOutcome> {
  const dateStr = String(params.formData.get("date") ?? "");
  const timeStr = String(params.formData.get("time") ?? "");
  const name = String(params.formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(params.formData.get("contact") ?? "").trim().slice(0, 120);
  const email = String(params.formData.get("email") ?? "").trim().slice(0, 180);
  const requestedProfessionalId = String(params.formData.get("professional") ?? "").trim() || null;

  if (!dateStr || !timeStr || !name || !contact) {
    return { ok: false, dateStr, error: "Faltan datos — completa nombre y contacto." };
  }

  const result = await bookAppointment({
    websiteId: params.websiteId,
    dateStr,
    timeStr,
    name,
    contact,
    email: email || null,
    professionalId: requestedProfessionalId,
  });
  if (!result.ok) {
    return { ok: false, dateStr, error: result.error };
  }
  const assignedProfessional = result.professionalId
    ? (params.professionals.find((p) => p.id === result.professionalId) ?? null)
    : null;

  // So this lead shows up in the CRM ("Nuevo" stage) and can be messaged or
  // included in a broadcast — a booking is a real contact left behind, same
  // as the lead-capture form (see lib/websiteLeads.ts's captureWebsiteLead).
  // Awaited, unlike the emails below — this is core data (the lead's actual
  // CRM record), not a best-effort notification safe to drop if the
  // function's execution gets cut short right after responding.
  await upsertLeadConversation({ websiteId: params.websiteId, name, contact });

  const dateLabel = formatDateLabel(dateStr);
  const withProfessional = assignedProfessional ? ` con ${escapeHtml(assignedProfessional.name)}` : "";

  // Attached to every notification below so the appointment lands straight
  // on the recipient's own calendar app (Google Calendar, Outlook, Apple
  // Calendar) without anyone opening Funnels Labs — see lib/ics.ts.
  const endsAt = new Date(result.startsAt.getTime() + params.slotMinutes * 60 * 1000);
  const icsContent = buildIcsEvent({
    uid: `${result.appointmentId}@funnelslabs.app`,
    summary: `Cita: ${name}${withProfessional} — ${params.businessName}`,
    description: `Nombre: ${name}\nContacto: ${contact}${email ? `\nCorreo: ${email}` : ""}`,
    startsAt: result.startsAt,
    endsAt,
  });
  const icsFilename = "cita.ics";

  void sendEmail({
    to: params.notificationEmail,
    subject: `Nueva cita agendada: ${name}`,
    html: `
      <p>Tienes una nueva cita agendada${withProfessional} desde tu página web.</p>
      <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
      <p>Nombre: ${escapeHtml(name)}<br>Contacto: ${escapeHtml(contact)}${email ? `<br>Correo: ${escapeHtml(email)}` : ""}</p>
    `,
    icsContent,
    icsFilename,
  });
  if (email) {
    void sendEmail({
      to: email,
      subject: `Tu cita con ${params.businessName} está confirmada`,
      html: `
        <p>¡Listo! Tu cita con <strong>${escapeHtml(params.businessName)}</strong>${withProfessional} quedó confirmada.</p>
        <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
        <p>Si necesitas cambiarla, contáctanos directamente.</p>
      `,
      icsContent,
      icsFilename,
    });
  }
  // The professional gets their own heads-up too, so they have it on their
  // radar without needing to check the dashboard — separate from the
  // business's notificationEmail, which might go to a front-desk inbox
  // instead of the specific person doing the appointment.
  if (assignedProfessional?.email) {
    void sendEmail({
      to: assignedProfessional.email,
      subject: `Nueva cita: ${name} — ${dateLabel} a las ${timeStr}`,
      html: `
        <p>Te agendaron una cita en ${escapeHtml(params.businessName)}.</p>
        <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
        <p>Nombre: ${escapeHtml(name)}<br>Contacto: ${escapeHtml(contact)}${email ? `<br>Correo: ${escapeHtml(email)}` : ""}</p>
      `,
      icsContent,
      icsFilename,
    });
  }

  return { ok: true, dateStr, timeStr, professionalId: assignedProfessional?.id ?? null };
}

/** Preview traffic (the dashboard's own "Vista previa") never books a real slot or sends real emails — just echoes back what was submitted as if it succeeded. */
export function previewAgendaBookingOutcome(formData: FormData): AgendaBookingOutcome {
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const professionalId = String(formData.get("professional") ?? "").trim() || null;
  return { ok: true, dateStr, timeStr, professionalId };
}
