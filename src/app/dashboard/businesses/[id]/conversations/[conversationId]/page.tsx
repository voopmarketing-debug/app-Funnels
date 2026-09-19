import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ConversationThread } from "../../ConversationThread";
import { LeadDetailPanel } from "../../LeadDetailPanel";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; conversationId: string }>;
}) {
  const { id, conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
  });
  if (!membership) notFound();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId: id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  const [business, stages] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.pipelineStage.findMany({ where: { businessId: id }, orderBy: { position: "asc" } }),
  ]);

  return (
    <div className="fl-card mx-auto flex h-[calc(100vh-8rem)] max-w-5xl overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationThread
          businessId={id}
          conversationId={conversationId}
          businessName={business.name}
          customerName={conversation.customerName}
          customerPhone={conversation.customerPhone}
          aiPaused={conversation.aiPaused}
          stageId={conversation.stageId}
          stages={stages}
          messages={conversation.messages}
        />
      </div>
      <LeadDetailPanel
        businessId={id}
        conversationId={conversationId}
        customerPhone={conversation.customerPhone}
        tags={conversation.tags}
        notes={conversation.notes}
        appointmentAt={conversation.appointmentAt}
        appointmentNote={conversation.appointmentNote}
      />
    </div>
  );
}
