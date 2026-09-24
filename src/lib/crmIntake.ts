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
export async function upsertLeadConversation(params: { websiteId: string; name: string; contact: string }): Promise<void> {
  const phone = params.contact.replace(/[^0-9]/g, "");
  const name = params.name.trim();
  if (!phone || !name) return;

  const website = await prisma.website.findUnique({ where: { id: params.websiteId }, select: { businessId: true } });
  if (!website) return;

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { businessId: website.businessId, pipeline: { isDefault: true } },
    orderBy: { position: "asc" },
  });
  if (!firstStage) return;

  await prisma.conversation.upsert({
    where: { businessId_customerPhone: { businessId: website.businessId, customerPhone: phone } },
    update: { customerName: name },
    create: {
      businessId: website.businessId,
      customerPhone: phone,
      customerName: name,
      stageId: firstStage.id,
    },
  });
}
