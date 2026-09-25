import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isReplyWindowOpen } from "@/lib/messageWindow";
import { PipelineManager } from "../PipelineManager";
import { CrmBoard } from "../CrmBoard";
import { ContactsTable } from "../ContactsTable";
import { CrmTabs } from "./CrmTabs";
import { PipelineSwitcher } from "./PipelineSwitcher";
import { ConversationSplitView } from "./ConversationSplitView";
import { BroadcastDialog } from "./BroadcastDialog";
import { BroadcastHistory } from "./BroadcastHistory";
import { AgentSwitcher } from "../AgentSwitcher";
import { CrmLivePoller } from "./CrmLivePoller";

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
  // CRM for day to day; Tablero/Lista/Difusiones are reached via their own
  // ?tab= link.
  const tab = tabParam === "board" || tabParam === "list" || tabParam === "broadcasts" ? tabParam : "chat";

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

  const [business, conversations, accessibleBusinesses, approvedTemplates, stageCounts, totalConversations] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.conversation.findMany({
      where: { businessId: id, stage: { pipelineId: selectedPipeline.id } },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      select: { id: true, customerName: true, customerPhone: true, stageId: true, lastMessageAt: true, lastReadAt: true },
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
    // How many contacts a broadcast would actually reach per stage — same
    // scope sendBroadcast itself queries (businessId + stageId, no pipeline
    // filter — "Todo el pipeline" in BroadcastDialog really means every
    // conversation on this business, matching that action's own behavior).
    prisma.conversation.groupBy({ by: ["stageId"], where: { businessId: id }, _count: { _all: true } }),
    prisma.conversation.count({ where: { businessId: id } }),
  ]);
  const stages = selectedPipeline.stages;
  const stageCountMap = Object.fromEntries(stageCounts.map((s) => [s.stageId, s._count._all]));

  // WhatsApp-style unread badge: count each conversation's CUSTOMER
  // messages newer than its lastReadAt (null = never opened, so everything
  // counts). Bounded to the last 60 days — a chat nobody's opened in longer
  // than that doesn't need an exact count, just "unread".
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const recentCustomerMessages = await prisma.message.findMany({
    where: { conversationId: { in: conversations.map((c) => c.id) }, role: "CUSTOMER", createdAt: { gte: sixtyDaysAgo } },
    select: { conversationId: true, createdAt: true },
  });
  const unreadCountByConversation = new Map<string, number>();
  for (const m of recentCustomerMessages) {
    const conversation = conversations.find((c) => c.id === m.conversationId);
    if (conversation && (!conversation.lastReadAt || m.createdAt > conversation.lastReadAt)) {
      unreadCountByConversation.set(m.conversationId, (unreadCountByConversation.get(m.conversationId) ?? 0) + 1);
    }
  }

  const conversationSummaries = conversations.map((c) => ({
    id: c.id,
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    stageId: c.stageId,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unreadCount: unreadCountByConversation.get(c.id) ?? 0,
  }));

  // Only queried when the Difusiones tab is actually open — every other tab
  // doesn't need this, so it stays out of the main Promise.all above.
  let broadcastsView: {
    id: string;
    message: string;
    stageName: string | null;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    delivered: number;
    read: number;
    failedAfterSend: number;
    ctaUrl: string | null;
    clickCount: number;
    createdAt: Date;
  }[] = [];
  if (tab === "broadcasts") {
    const stageNameById = new Map(allPipelines.flatMap((p) => p.stages).map((s) => [s.id, s.name]));
    const broadcasts = await prisma.broadcast.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        message: true,
        stageId: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        ctaUrl: true,
        clickCount: true,
        createdAt: true,
      },
    });
    const deliveryStats = await prisma.message.groupBy({
      by: ["broadcastId", "deliveryStatus"],
      where: { broadcastId: { in: broadcasts.map((b) => b.id) } },
      _count: { _all: true },
    });
    const deliveryByBroadcast = new Map(broadcasts.map((b) => [b.id, { delivered: 0, read: 0, failedAfterSend: 0 }]));
    for (const row of deliveryStats) {
      const bucket = row.broadcastId ? deliveryByBroadcast.get(row.broadcastId) : undefined;
      if (!bucket) continue;
      const count = row._count._all;
      // "Entregados" is cumulative (read implies it was delivered first),
      // same convention WhatsApp's own double-check marks use.
      if (row.deliveryStatus === "read") {
        bucket.read += count;
        bucket.delivered += count;
      } else if (row.deliveryStatus === "delivered") {
        bucket.delivered += count;
      } else if (row.deliveryStatus === "failed") {
        bucket.failedAfterSend += count;
      }
    }
    broadcastsView = broadcasts.map((b) => ({
      id: b.id,
      message: b.message,
      stageName: b.stageId ? (stageNameById.get(b.stageId) ?? null) : null,
      totalRecipients: b.totalRecipients,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      ...(deliveryByBroadcast.get(b.id) ?? { delivered: 0, read: 0, failedAfterSend: 0 }),
      ctaUrl: b.ctaUrl,
      clickCount: b.clickCount,
      createdAt: b.createdAt,
    }));
  }

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
        windowOpen: isReplyWindowOpen(full.messages),
      };

      // Opening the chat is what "read" means here — matches WhatsApp: the
      // badge/highlight clears the moment you look at the conversation, not
      // when you reply to it. Zero it in the already-computed map too, so
      // this same render doesn't still show the stale badge for the chat
      // that's open right now.
      await prisma.conversation.update({ where: { id: full.id }, data: { lastReadAt: new Date() } });
      unreadCountByConversation.delete(full.id);
    }
  }

  return (
    <div className="space-y-6">
      <CrmLivePoller businessId={id} />
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
          <BroadcastDialog
            businessId={id}
            stages={stages}
            templates={approvedTemplates}
            stageCounts={stageCountMap}
            totalConversations={totalConversations}
          />
        </div>

        {tab === "board" && <CrmBoard businessId={id} stages={stages} conversations={conversationSummaries} />}
        {tab === "list" && <ContactsTable businessId={id} stages={stages} conversations={conversationSummaries} />}
        {tab === "broadcasts" && <BroadcastHistory broadcasts={broadcastsView} />}
        {tab === "chat" && (
          <ConversationSplitView
            businessId={id}
            businessName={business.name}
            stages={stages}
            conversations={conversationSummaries}
            selectedConversationId={conv ?? null}
            selectedConversation={selectedConversation}
            templates={approvedTemplates}
          />
        )}
      </div>
    </div>
  );
}
