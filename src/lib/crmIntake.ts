import { prisma } from "@/lib/prisma";

/**
 * Adds (or updates) a CRM Conversation for someone who left their contact
 * info through the public website — the agenda booking form
 * (lib/agendaBooking.ts) or the lead-capture form (lib/websiteLeads.ts) —
 * so they land in the CRM's default pipeline, "Nuevo" stage, where the
 * business can start a conversation with them or include them in a
 * broadcast. Without this they only existed as an Appointment/WebsiteLead
 * row with no way to message them from the dashboard.
 *
 * Dedupes on (businessId, customerPhone) — the same unique constraint
 * lib/agent.ts's inbound-WhatsApp handler uses for the exact same upsert —
 * so someone who already has a conversation (from WhatsApp, or an earlier
 * booking/registration) doesn't get a duplicate; only their name refreshes.
 * `contact` is normalized to digits-only before matching, since a visitor
 * might type "+57 300 123 4567" while WhatsApp's own webhook always uses
 * the bare-digits form — without normalizing, the same real person would
 * silently create a second conversation instead of being recognized.
 */
export async function upsertLeadConversation(params: {
  websiteId: string;
  name: string;
  contact: string;
  // Only set by lib/agendaBooking.ts, when this lead's entry point WAS a
  // real booking — fills the same "Cita agendada" field the AI's own
  // mark_appointment tool writes (see lib/ai.ts), so a booking made from
  // the public page shows up in the chat panel without anyone re-typing it
  // by hand. Left undefined for the plain lead-capture form (websiteLeads.ts
  // has no appointment to report), which must never blank out an existing
  // appointment set some other way — so it's only included in the write
  // when actually provided.
  appointmentAt?: Date;
  appointmentNote?: string;
  // Set by lib/agendaBooking.ts when the booking was made with a
  // professional who has their own pipeline configured (Professional.pipelineId)
  // — routes the conversation into THEIR embudo instead of the business's
  // default one, so each salesperson works their own board. Undefined for
  // every other caller (plain lead-capture form, or a professional with no
  // pipeline set), which keeps today's default-pipeline behavior.
  pipelineId?: string;
}): Promise<void> {
  const phone = params.contact.replace(/[^0-9]/g, "");
  const name = params.name.trim();
  if (!phone || !name) return;

  const website = await prisma.website.findUnique({ where: { id: params.websiteId }, select: { businessId: true } });
  if (!website) return;

  const targetStage = await prisma.pipelineStage.findFirst({
    where: {
      businessId: website.businessId,
      pipeline: params.pipelineId ? { id: params.pipelineId } : { isDefault: true },
    },
    orderBy: { position: "asc" },
  });
  if (!targetStage) return;

  const appointmentFields = params.appointmentAt
    ? { appointmentAt: params.appointmentAt, appointmentNote: params.appointmentNote ?? null }
    : {};
  // Only move an ALREADY-EXISTING conversation's stage when there's a
  // specific pipeline to route it to (a professional's own embudo) — the
  // plain lead-capture form (no pipelineId) must never yank a conversation
  // back to stage one after a rep has already moved it further down their
  // board.
  const stageFields = params.pipelineId ? { stageId: targetStage.id } : {};

  await prisma.conversation.upsert({
    where: { businessId_customerPhone: { businessId: website.businessId, customerPhone: phone } },
    update: { customerName: name, ...stageFields, ...appointmentFields },
    create: {
      businessId: website.businessId,
      customerPhone: phone,
      customerName: name,
      stageId: targetStage.id,
      ...appointmentFields,
    },
  });
}
