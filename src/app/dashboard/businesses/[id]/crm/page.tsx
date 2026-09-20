import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PipelineManager } from "../PipelineManager";
import { CrmBoard } from "../CrmBoard";
import { ContactsTable } from "../ContactsTable";
import { CrmTabs } from "./CrmTabs";
import { PipelineSwitcher } from "./PipelineSwitcher";
import { ConversationSplitView } from "./ConversationSplitView";
import { BroadcastDialog } from "./BroadcastDialog";
import { AgentSwitcher } from "../AgentSwitcher";

export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; conv?: string; pipeline?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, conv, pipeline: pipelineParam } = await searchParams;
  // Conversaciones is the default landing view — it's what an agency opens
  // CRM for day to day; Tablero/Lista are reached via their own ?tab= link.
  const tab = tabParam === "board" || tabParam === "list" ? tabParam : "chat";

  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
  });
  if (!membership) notFound();

  // A business can have several embudos (funnels) — e.g. one per
  // salesperson, all sharing the same WhatsApp number but each working their
  // own board. Everything below (board/list/chat/broadcast/stage editor) is
  // scoped to whichever one is selected via PipelineSwitcher, defaulting to
  // the "principal" one every new inbound conversation lands in.
  const allPipelines = await prisma.pipeline.findMany({
    where: { businessId: id },
    orderBy: { position: "asc" },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  const selectedPipeline =
    allPipelines.find((p) => p.id === pipelineParam) ?? allPipelines.find((p) => p.isDefault) ?? allPipelines[0];

  const [business, conversations, accessibleBusinesses, approvedTemplates] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.conversation.findMany({
      where: { businessId: id, stage: { pipelineId: selectedPipeline.id } },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.membership.findMany({
      where: { userId: session.user.id },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.messageTemplate.findMany({
      where: { businessId: id, status: "APPROVED" },
      select: { id: true, name: true, bodyText: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const stages = selectedPipeline.stages;

  const conversationSummaries = conversations.map((c) => ({
    id: c.id,
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    stageId: c.stageId,
    lastMessageAt: c.lastMessageAt.toISOString(),
  }));

  let selectedConversation = null;
  if (tab === "chat" && conv) {
    const full = await prisma.conversation.findFirst({
      where: { id: conv, businessId: id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (full) {
      selectedConversation = {
        customerName: full.customerName,
        customerPhone: full.customerPhone,
        aiPaused: full.aiPaused,
        stageId: full.stageId,
        tags: full.tags,
        notes: full.notes,
        appointmentAt: full.appointmentAt,
        appointmentNote: full.appointmentNote,
        messages: full.messages,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">CRM</h1>
          <AgentSwitcher businesses={accessibleBusinesses.map((m) => m.business)} currentId={id} section="crm" />
        </div>
      </div>

      <PipelineManager businessId={id} pipelines={allPipelines} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CrmTabs activeTab={tab} />
            {allPipelines.length > 1 && (
              <PipelineSwitcher
                pipelines={allPipelines.map((p) => ({ id: p.id, name: p.name }))}
                selectedPipelineId={selectedPipeline.id}
              />
            )}
          </div>
          <BroadcastDialog businessId={id} stages={stages} templates={approvedTemplates} />
        </div>

        {tab === "board" && <CrmBoard businessId={id} stages={stages} conversations={conversationSummaries} />}
        {tab === "list" && <ContactsTable businessId={id} stages={stages} conversations={conversationSummaries} />}
        {tab === "chat" && (
          <ConversationSplitView
            businessId={id}
            businessName={business.name}
            stages={stages}
            conversations={conversationSummaries}
            selectedConversationId={conv ?? null}
            selectedConversation={selectedConversation}
          />
        )}
      </div>
    </div>
  );
}
