import { prisma } from "@/lib/prisma";

// How many days of daily-bucketed history the trend charts cover. Kept short
// on purpose — this is a per-business operational dashboard (like Chatwoot's
// or Intercom's "last 30 days" view), not a long-term BI report.
const TREND_DAYS = 30;

// Errors are persisted as normal AGENT messages (see logInternalError in
// lib/agent.ts) so they show up in the conversation thread — but they must
// never be counted as a real AI reply for automation rate, response time, or
// the message-volume charts, or those numbers would be wrong.
const ERROR_PREFIX = "[ERROR INTERNO";

export type DailyPoint = { date: string; value: number };
export type DailyMessagePoint = { date: string; cliente: number; ia: number; humano: number };
export type StagePoint = { name: string; position: number; count: number };
export type ResponseTimeStats = { avgMinutes: number | null; medianMinutes: number | null; sampleSize: number };

export type BusinessAnalytics = {
  totalConversations: number;
  newConversations: number;
  totalMessages: number;
  automationRate: number | null;
  errorRate: number | null;
  responseTime: ResponseTimeStats;
  awaitingReply: number;
  activeLast24h: number;
  conversationsTrend: DailyPoint[];
  messagesTrend: DailyMessagePoint[];
  stageDistribution: StagePoint[];
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDayRange(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(dayKey(d));
  }
  return keys;
}

export async function getBusinessAnalytics(businessId: string): Promise<BusinessAnalytics> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (TREND_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [totalConversations, newConversations, recentConversations, recentMessages, stages, conversationsForActivity] =
    await Promise.all([
      prisma.conversation.count({ where: { businessId } }),
      prisma.conversation.count({ where: { businessId, createdAt: { gte: since } } }),
      prisma.conversation.findMany({
        where: { businessId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.message.findMany({
        where: { conversation: { businessId }, createdAt: { gte: since } },
        select: { createdAt: true, role: true, sentByHuman: true, content: true, conversationId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.pipelineStage.findMany({
        where: { businessId },
        orderBy: { position: "asc" },
        include: { _count: { select: { conversations: true } } },
      }),
      prisma.conversation.findMany({
        where: { businessId },
        select: {
          lastMessageAt: true,
          messages: { take: 1, orderBy: { createdAt: "desc" }, select: { role: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 2000,
      }),
    ]);

  const dayKeys = buildDayRange(TREND_DAYS);

  const conversationsByDay = new Map(dayKeys.map((k) => [k, 0]));
  for (const c of recentConversations) {
    const k = dayKey(c.createdAt);
    if (conversationsByDay.has(k)) conversationsByDay.set(k, (conversationsByDay.get(k) ?? 0) + 1);
  }

  const messagesByDay = new Map(dayKeys.map((k) => [k, { cliente: 0, ia: 0, humano: 0 }]));
  const byConversation = new Map<string, typeof recentMessages>();
  let iaCount = 0;
  let humanoCount = 0;
  let errorCount = 0;

  for (const m of recentMessages) {
    const isError = m.role === "AGENT" && m.content.startsWith(ERROR_PREFIX);
    const bucket = messagesByDay.get(dayKey(m.createdAt));
    if (bucket) {
      if (m.role === "CUSTOMER") bucket.cliente += 1;
      else if (!isError) {
        if (m.sentByHuman) bucket.humano += 1;
        else bucket.ia += 1;
      }
    }

    if (m.role === "AGENT") {
      if (isError) errorCount += 1;
      else if (m.sentByHuman) humanoCount += 1;
      else iaCount += 1;
    }

    const list = byConversation.get(m.conversationId);
    if (list) list.push(m);
    else byConversation.set(m.conversationId, [m]);
  }

  // First-response time: for every run of consecutive customer messages,
  // measure from the first one until the next real (non-error) agent reply —
  // the same "time to first response" Chatwoot/Intercom-style inboxes track.
  const responseSamplesMs: number[] = [];
  for (const list of byConversation.values()) {
    let pendingSince: Date | null = null;
    for (const m of list) {
      const isError = m.role === "AGENT" && m.content.startsWith(ERROR_PREFIX);
      if (m.role === "CUSTOMER") {
        if (!pendingSince) pendingSince = m.createdAt;
      } else if (!isError && pendingSince) {
        responseSamplesMs.push(m.createdAt.getTime() - pendingSince.getTime());
        pendingSince = null;
      }
    }
  }
  responseSamplesMs.sort((a, b) => a - b);
  const avgMinutes =
    responseSamplesMs.length === 0
      ? null
      : responseSamplesMs.reduce((sum, ms) => sum + ms, 0) / responseSamplesMs.length / 60000;
  const medianMinutes =
    responseSamplesMs.length === 0
      ? null
      : responseSamplesMs[Math.floor(responseSamplesMs.length / 2)] / 60000;

  const totalAgentEvents = iaCount + humanoCount + errorCount;
  const automationRate = iaCount + humanoCount === 0 ? null : (iaCount / (iaCount + humanoCount)) * 100;
  const errorRate = totalAgentEvents === 0 ? null : (errorCount / totalAgentEvents) * 100;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let awaitingReply = 0;
  let activeLast24h = 0;
  for (const c of conversationsForActivity) {
    if (c.messages[0]?.role === "CUSTOMER") awaitingReply += 1;
    if (now - c.lastMessageAt.getTime() < dayMs) activeLast24h += 1;
  }

  return {
    totalConversations,
    newConversations,
    totalMessages: recentMessages.length,
    automationRate,
    errorRate,
    responseTime: { avgMinutes, medianMinutes, sampleSize: responseSamplesMs.length },
    awaitingReply,
    activeLast24h,
    conversationsTrend: dayKeys.map((date) => ({ date, value: conversationsByDay.get(date) ?? 0 })),
    messagesTrend: dayKeys.map((date) => ({
      date,
      ...(messagesByDay.get(date) ?? { cliente: 0, ia: 0, humano: 0 }),
    })),
    stageDistribution: stages.map((s) => ({ name: s.name, position: s.position, count: s._count.conversations })),
  };
}

// "Contacto activo" for plan-limit purposes (see src/lib/plans.ts): a
// distinct customer who wrote at least once this calendar month — matches
// the definition on the public pricing page, not just newly created
// conversations, so a returning customer from an older conversation counts
// too.
export async function getActiveContactsThisMonth(businessId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const rows = await prisma.message.findMany({
    where: { conversation: { businessId }, role: "CUSTOMER", createdAt: { gte: startOfMonth } },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });

  return rows.length;
}
