import { bookAppointment } from "@/lib/agenda";
import { formatDateLabel } from "@/lib/agendaTemplate";
import { sendEmail } from "@/lib/email";

// The name/contact/email fields below come straight from a public,
// unauthenticated form — interpolated raw into an HTML email body, they'd
// be an HTML-injection vector into whatever mail client renders it.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type AgendaBookingOutcome =
  | { ok: true; dateStr: string; timeStr: string }
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
  // The already-loaded professional the visitor picked (or null on a
  // single-provider agenda) — passed in by the caller (route.ts/proxy.ts,
  // which already fetched the professionals list to render the picker) so
  // this function doesn't need its own extra query just for their name/email.
  professional?: { id: string; name: string; email: string | null } | null;
}): Promise<AgendaBookingOutcome> {
  const dateStr = String(params.formData.get("date") ?? "");
  const timeStr = String(params.formData.get("time") ?? "");
  const name = String(params.formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(params.formData.get("contact") ?? "").trim().slice(0, 120);
  const email = String(params.formData.get("email") ?? "").trim().slice(0, 180);

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
    professionalId: params.professional?.id ?? null,
  });
  if (!result.ok) {
    return { ok: false, dateStr, error: result.error };
  }

  const dateLabel = formatDateLabel(dateStr);
  const withProfessional = params.professional ? ` con ${escapeHtml(params.professional.name)}` : "";
  void sendEmail({
    to: params.notificationEmail,
    subject: `Nueva cita agendada: ${name}`,
    html: `
      <p>Tienes una nueva cita agendada${withProfessional} desde tu página web.</p>
      <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
      <p>Nombre: ${escapeHtml(name)}<br>Contacto: ${escapeHtml(contact)}${email ? `<br>Correo: ${escapeHtml(email)}` : ""}</p>
    `,
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
    });
  }
  // The professional gets their own heads-up too, so they have it on their
  // radar without needing to check the dashboard — separate from the
  // business's notificationEmail, which might go to a front-desk inbox
  // instead of the specific person doing the appointment.
  if (params.professional?.email) {
    void sendEmail({
      to: params.professional.email,
      subject: `Nueva cita: ${name} — ${dateLabel} a las ${timeStr}`,
      html: `
        <p>Te agendaron una cita en ${escapeHtml(params.businessName)}.</p>
        <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
        <p>Nombre: ${escapeHtml(name)}<br>Contacto: ${escapeHtml(contact)}${email ? `<br>Correo: ${escapeHtml(email)}` : ""}</p>
      `,
    });
  }

  return { ok: true, dateStr, timeStr };
}

/** Preview traffic (the dashboard's own "Vista previa") never books a real slot or sends real emails — just echoes back what was submitted as if it succeeded. */
export function previewAgendaBookingOutcome(formData: FormData): AgendaBookingOutcome {
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  return { ok: true, dateStr, timeStr };
}
