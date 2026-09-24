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
}): Promise<AgendaBookingOutcome> {
  const dateStr = String(params.formData.get("date") ?? "");
  const timeStr = String(params.formData.get("time") ?? "");
  const name = String(params.formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(params.formData.get("contact") ?? "").trim().slice(0, 120);
  const email = String(params.formData.get("email") ?? "").trim().slice(0, 180);

  if (!dateStr || !timeStr || !name || !contact) {
    return { ok: false, dateStr, error: "Faltan datos — completa nombre y contacto." };
  }

  const result = await bookAppointment({ websiteId: params.websiteId, dateStr, timeStr, name, contact, email: email || null });
  if (!result.ok) {
    return { ok: false, dateStr, error: result.error };
  }

  const dateLabel = formatDateLabel(dateStr);
  void sendEmail({
    to: params.notificationEmail,
    subject: `Nueva cita agendada: ${name}`,
    html: `
      <p>Tienes una nueva cita agendada desde tu página web.</p>
      <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
      <p>Nombre: ${escapeHtml(name)}<br>Contacto: ${escapeHtml(contact)}${email ? `<br>Correo: ${escapeHtml(email)}` : ""}</p>
    `,
  });
  if (email) {
    void sendEmail({
      to: email,
      subject: `Tu cita con ${params.businessName} está confirmada`,
      html: `
        <p>¡Listo! Tu cita con <strong>${escapeHtml(params.businessName)}</strong> quedó confirmada.</p>
        <p><strong>${escapeHtml(dateLabel)} a las ${escapeHtml(timeStr)}</strong></p>
        <p>Si necesitas cambiarla, contáctanos directamente.</p>
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
