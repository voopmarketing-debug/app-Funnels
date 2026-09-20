import { prisma } from "@/lib/prisma";
import { type DateRangeKey } from "@/lib/dateRanges";
import { estimateCostUsd } from "@/lib/aiCost";

export { DATE_RANGE_OPTIONS, isDateRangeKey, type DateRangeKey } from "@/lib/dateRanges";

// Errors and plan-limit pauses are persisted as normal AGENT messages (see
// logInternalError and logPlanLimitNotice in lib/agent.ts) so they show up
// in the conversation thread — but neither is a real AI reply, so both must
// stay out of automation rate, response time, and the message-volume
// charts, or those numbers would be wrong. Only the error prefix counts
// toward "Tasa de error IA" — a plan-limit pause isn't a technical failure,
// it's an intentional cost guardrail, and would mislabel the KPI if counted
// there too.
const ERROR_PREFIX = "[ERROR INTERNO";
const PLAN_LIMIT_PREFIX = "[LÍMITE DE PLAN";

function isSystemNotice(role: string, content: string): boolean {
  return role === "AGENT" && (content.startsWith(ERROR_PREFIX) || content.startsWith(PLAN_LIMIT_PREFIX));
}

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
  // Real spend from stored token usage (see aiCost.ts) — null when no
  // message in this range has usage data yet (e.g. before this tracking
  // shipped, or a range with zero AI replies), never zero-by-omission.
  realAiCostUsd: number | null;
  awaitingReply: number;
  activeLast24h: number;
  conversationsTrend: DailyPoint[];
  messagesTrend: DailyMessagePoint[];
  stageDistribution: StagePoint[];
  // Visits and CTA-button clicks across every Website page this business
  // has generated (see WebsiteEvent, logged from app/sitio/[slug]/route.ts,
  // its /ir click redirect, and proxy.ts for connected custom domains).
  // Clicks are split by where the button actually sent the visitor — kept
  // as two separate numbers on purpose, never combined into one "clicks".
  websiteViews: number;
  websiteClicksWhatsapp: number;
  websiteClicksAgenda: number;
  // Result-oriented metrics, as opposed to the operational/health ones
  // above — "is this actually turning into business," not just "is the
  // agent behaving." appointmentsBooked counts conversations whose
  // appointmentAt (manually recorded, see schema.prisma) falls inside this
  // range; appointmentConversionRate is that over newConversations in the
  // same range (null when there were no new conversations to convert).
  // websiteLeads reuses WebsiteLead the same way clicks reuse WebsiteEvent.
  appointmentsBooked: number;
  appointmentConversionRate: number | null;
  websiteLeads: number;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// "today"/"yesterday" are fixed calendar-day windows; "Nd" options are a
// rolling window of N calendar days ending today (inclusive) — same
// convention the dashboard used before this was configurable.
function resolveDateRange(key: DateRangeKey, now: Date): { since: Date; until: Date } {
  const startOfToday = startOfUtcDay(now);

  if (key === "today") return { since: startOfToday, until: now };

  if (key === "yesterday") {
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
    return { since: startOfYesterday, until: startOfToday };
  }

  const days = key === "7d" ? 7 : key === "15d" ? 15 : 30;
  const since = new Date(startOfToday);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return { since, until: now };
}

function buildDayKeys(key: DateRangeKey, now: Date): string[] {
  const startOfToday = startOfUtcDay(now);

  if (key === "today") return [dayKey(startOfToday)];

  if (key === "yesterday") {
    const yesterday = new Date(startOfToday);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return [dayKey(yesterday)];
  }

  const days = key === "7d" ? 7 : key === "15d" ? 15 : 30;
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

export async function getBusinessAnalytics(
  businessId: string,
  rangeKey: DateRangeKey = "30d",
): Promise<BusinessAnalytics> {
  const now = new Date();
  const { since, until } = resolveDateRange(rangeKey, now);

  const [
    totalConversations,
    newConversations,
    recentConversations,
    recentMessages,
    stages,
    conversationsForActivity,
    websiteViews,
    websiteClicksWhatsapp,
    websiteClicksAgenda,
    appointmentsBooked,
    websiteLeads,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId } }),
    prisma.conversation.count({ where: { businessId, createdAt: { gte: since, lt: until } } }),
    prisma.conversation.findMany({
      where: { businessId, createdAt: { gte: since, lt: until } },
      select: { createdAt: true },
    }),
    prisma.message.findMany({
      where: { conversation: { businessId }, createdAt: { gte: since, lt: until } },
      select: {
        createdAt: true,
        role: true,
        sentByHuman: true,
        content: true,
        conversationId: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        cacheCreationInputTokens: true,
        cacheReadInputTokens: true,
      },
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
    prisma.websiteEvent.count({
      where: { type: "view", createdAt: { gte: since, lt: until }, website: { businessId } },
    }),
    prisma.websiteEvent.count({
      where: { type: "cta_click", destination: "whatsapp", createdAt: { gte: since, lt: until }, website: { businessId } },
    }),
    prisma.websiteEvent.count({
      where: { type: "cta_click", destination: "agenda", createdAt: { gte: since, lt: until }, website: { businessId } },
    }),
    prisma.conversation.count({
      where: { businessId, appointmentAt: { gte: since, lt: until } },
    }),
    prisma.websiteLead.count({
      where: { createdAt: { gte: since, lt: until }, website: { businessId } },
    }),
  ]);

  const dayKeys = buildDayKeys(rangeKey, now);

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
  let realAiCostUsd = 0;
  let hasCostData = false;

  for (const m of recentMessages) {
    const cost = estimateCostUsd(m);
    if (cost !== null) {
      realAiCostUsd += cost;
      hasCostData = true;
    }

    const systemNotice = isSystemNotice(m.role, m.content);
    const bucket = messagesByDay.get(dayKey(m.createdAt));
    if (bucket) {
      if (m.role === "CUSTOMER") bucket.cliente += 1;
      else if (!systemNotice) {
        if (m.sentByHuman) bucket.humano += 1;
        else bucket.ia += 1;
      }
    }

    if (m.role === "AGENT") {
      if (m.content.startsWith(ERROR_PREFIX)) errorCount += 1;
      else if (systemNotice) {
        // Plan-limit pause: not an error, not a real reply — excluded from
        // every count on purpose (see isSystemNotice above).
      } else if (m.sentByHuman) humanoCount += 1;
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
      const systemNotice = isSystemNotice(m.role, m.content);
      if (m.role === "CUSTOMER") {
        if (!pendingSince) pendingSince = m.createdAt;
      } else if (!systemNotice && pendingSince) {
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

  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let awaitingReply = 0;
  let activeLast24h = 0;
  for (const c of conversationsForActivity) {
    if (c.messages[0]?.role === "CUSTOMER") awaitingReply += 1;
    if (nowMs - c.lastMessageAt.getTime() < dayMs) activeLast24h += 1;
  }

  return {
    totalConversations,
    newConversations,
    totalMessages: recentMessages.length,
    automationRate,
    errorRate,
    responseTime: { avgMinutes, medianMinutes, sampleSize: responseSamplesMs.length },
    realAiCostUsd: hasCostData ? realAiCostUsd : null,
    awaitingReply,
    activeLast24h,
    conversationsTrend: dayKeys.map((date) => ({ date, value: conversationsByDay.get(date) ?? 0 })),
    messagesTrend: dayKeys.map((date) => ({
      date,
      ...(messagesByDay.get(date) ?? { cliente: 0, ia: 0, humano: 0 }),
    })),
    stageDistribution: stages.map((s) => ({ name: s.name, position: s.position, count: s._count.conversations })),
    websiteViews,
    websiteClicksWhatsapp,
    websiteClicksAgenda,
    appointmentsBooked,
    appointmentConversionRate: newConversations === 0 ? null : (appointmentsBooked / newConversations) * 100,
    websiteLeads,
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

// Same "contacto activo" definition as getActiveContactsThisMonth, but
// pooled across every business (WhatsApp line) this account owns — an
// account's plan is one subscription covering up to LINE_LIMITS lines, so
// "hasta N contactos activos/mes" means N total for the account, not N per
// line. Used for plan-limit enforcement in lib/agent.ts; without this, a
// Starter account running its full 3 lines could reach 3× the intended
// contact volume for the price of one.
export async function getAccountActiveContactsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const ownedBusinesses = await prisma.membership.findMany({
    where: { userId, role: "OWNER" },
    select: { businessId: true },
  });
  const businessIds = ownedBusinesses.map((m) => m.businessId);
  if (businessIds.length === 0) return 0;

  const rows = await prisma.message.findMany({
    where: { conversation: { businessId: { in: businessIds } }, role: "CUSTOMER", createdAt: { gte: startOfMonth } },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });

  return rows.length;
}
