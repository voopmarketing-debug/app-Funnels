import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { describeWhatsAppErrorKind, isCriticalWhatsAppError, WhatsAppApiError, type WhatsAppErrorKind } from "@/lib/whatsappErrors";

const APP_HOST = process.env.APP_HOST ?? "agente.funnelslabs.app";
// One e-mail per business and kind of problem per hour: a bad token fails
// every reply, and the inbox must not fill up with the same warning.
const ALERT_EVERY_MS = 60 * 60 * 1000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * E-mails the owner of the platform (AGENCY_ADMIN_EMAIL) about a critical
 * WhatsApp problem, through the same e-mail integration as the rest of the
 * app. Never throws and never includes the access token: it must be safe to
 * call from inside a failing send.
 */
export async function alertAgencyOfWhatsAppProblem(params: {
  businessId: string | null;
  kind: WhatsAppErrorKind;
  /** What was being sent ("confirmación de cita", "respuesta del agente"…). */
  context: string;
  /** Meta's own message; it never contains the token. */
  detail: string;
}): Promise<void> {
  try {
    const to = process.env.AGENCY_ADMIN_EMAIL?.trim();
    if (!to) {
      console.error("[whatsapp-alert] AGENCY_ADMIN_EMAIL is not set; critical WhatsApp problem not e-mailed:", params.kind);
      return;
    }
    const key = `wa-critical:${params.businessId ?? "global"}:${params.kind}`;
    if (await isRateLimited(key, 1, ALERT_EVERY_MS)) return;
    await recordRateLimitEvent(key);

    const business = params.businessId ? await prisma.business.findUnique({ where: { id: params.businessId }, select: { name: true } }) : null;
    const label = describeWhatsAppErrorKind(params.kind);
    const link = params.businessId ? `<p><a href="https://${APP_HOST}/dashboard/businesses/${params.businessId}">Abrir el negocio</a></p>` : "";
    await sendEmail({
      to,
      subject: `⚠ WhatsApp: ${label}${business ? ` (${business.name})` : ""}`,
      html: `
        <p><strong>${escapeHtml(label)}</strong>${business ? ` en <strong>${escapeHtml(business.name)}</strong>` : ""}.</p>
        <p>Pasó al enviar: ${escapeHtml(params.context)}.</p>
        <p>Meta respondió: ${escapeHtml(params.detail.slice(0, 500))}</p>
        ${link}
        <p>Este aviso se envía como máximo una vez por hora para el mismo problema.</p>
      `,
    });
  } catch (err) {
    console.error("[whatsapp-alert] failed to send the alert:", err instanceof Error ? err.message : err);
  }
}

/** Alerts only when `err` is a critical WhatsApp API error; anything else (a one-off bad recipient, a rate limit) is just logged where it happened. */
export async function reportWhatsAppSendFailure(err: unknown, params: { businessId: string | null; context: string }): Promise<void> {
  if (!(err instanceof WhatsAppApiError) || !isCriticalWhatsAppError(err.kind)) return;
  await alertAgencyOfWhatsAppProblem({ businessId: params.businessId, kind: err.kind, context: params.context, detail: err.message });
}
