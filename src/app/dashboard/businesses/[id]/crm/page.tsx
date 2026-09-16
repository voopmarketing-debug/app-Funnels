import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PipelineManager } from "../PipelineManager";
import { CrmBoard } from "../CrmBoard";
import { ContactsTable } from "../ContactsTable";
import { CrmTabs } from "./CrmTabs";
import { ConversationSplitView } from "./ConversationSplitView";
import { AgentSwitcher } from "../AgentSwitcher";

export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; conv?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, conv } = await searchParams;
  const tab = tabParam === "list" || tabParam === "chat" ? tabParam : "board";

  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
  });
  if (!membership) notFound();

  const [business, stages, conversations, accessibleBusinesses] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.pipelineStage.findMany({ where: { businessId: id }, orderBy: { position: "asc" } }),
    prisma.conversation.findMany({
      where: { businessId: id },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.membership.findMany({
      where: { userId: session.user.id },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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

      <PipelineManager businessId={id} stages={stages} />

      <div className="space-y-3">
        <CrmTabs activeTab={tab} />

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
