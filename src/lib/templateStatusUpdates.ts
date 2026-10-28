import { prisma } from "@/lib/prisma";
import type { WhatsAppTemplateStatusUpdate } from "@/lib/whatsapp";
import { alertAgencyOfWhatsAppProblem } from "@/lib/whatsappAlerts";

type Mapped = { status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason: string | null } | null;

/**
 * Meta's template events in this app's three states. A paused or disabled
 * template can't be sent, so it counts as rejected, with the reason shown in
 * the Plantillas list. FLAGGED is only a warning and changes nothing.
 */
export function templateStatusFromEvent(event: string, reason: string | undefined): Mapped {
  switch (event) {
    case "APPROVED":
    case "REINSTATED":
      return { status: "APPROVED", rejectionReason: null };
    case "REJECTED":
      return { status: "REJECTED", rejectionReason: reason ?? "Meta no la aprobó" };
    case "PAUSED":
      return { status: "REJECTED", rejectionReason: "Pausada por Meta por baja calidad. Se reactiva sola o crea una nueva" };
    case "DISABLED":
      return { status: "REJECTED", rejectionReason: "Deshabilitada por Meta. Crea una nueva" };
    case "PENDING":
    case "IN_APPEAL":
      return { status: "PENDING", rejectionReason: null };
    default:
      return null;
  }
}

const APPOINTMENT_TEMPLATE_NAMES = new Set(["confirmacion_cita", "recordatorio_cita", "link_agendamiento"]);

/** Applies one "message_template_status_update" webhook to the template's record; never throws. */
export async function applyTemplateStatusUpdate(update: WhatsAppTemplateStatusUpdate): Promise<void> {
  const mapped = templateStatusFromEvent(update.event, update.reason);
  if (!mapped) return;
  const business = await prisma.business.findFirst({ where: { wabaId: update.wabaId }, select: { id: true, name: true } });
  if (!business) return;

  const changed = await prisma.messageTemplate.updateMany({
    where: { businessId: business.id, name: update.name, ...(update.language ? { language: update.language } : {}) },
    data: { status: mapped.status, rejectionReason: mapped.rejectionReason },
  });

  if (mapped.status === "REJECTED") {
    await prisma.notification.create({
      data: { businessId: business.id, type: "TEMPLATE_STATUS", message: `La plantilla "${update.name}" quedó sin poder usarse: ${mapped.rejectionReason}.` },
    });
    if (APPOINTMENT_TEMPLATE_NAMES.has(update.name)) {
      await alertAgencyOfWhatsAppProblem({
        businessId: business.id,
        kind: update.event === "REJECTED" ? "TEMPLATE_MISSING" : "TEMPLATE_UNAVAILABLE",
        context: `plantilla ${update.name}`,
        detail: `${update.event}${update.reason ? `: ${update.reason}` : ""}`,
      });
    }
  }
  if (changed.count === 0) console.info(`[templates] status update for "${update.name}" (${update.event}): no matching record, ignored`);
}
