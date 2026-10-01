import { Prisma, type PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/aiCost";
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICE_USD } from "@/lib/plans";

/**
 * Agency-only: what each client account brings in vs. what it costs us in
 * AI for a calendar month (UTC, like the plan-limit counters). Revenue is
 * the account's monthly price (list price or its own override) plus packs
 * activated that month; costs are every AI call we can attribute to its
 * WhatsApp lines (reply tokens on Message + AiUsage rows) and the payment
 * processors' cut. Meta's WhatsApp fees are billed to the client's own
 * Meta account, so they're not ours.
 */

// Reference figures — adjust here if the deals change.
export const COP_PER_USD = 4000;
// Plans and packs are charged through Mercado Pago (~4% per payment).
const MERCADOPAGO_FEE_RATE = 0.04;

export const FIXED_COSTS_USD: { label: string; amount: number }[] = [
  { label: "Vercel Pro", amount: 20 },
  { label: "Lovable", amount: 25 },
  { label: "Claude Code", amount: 20 },
  { label: "Base de datos (Neon)", amount: 0 },
  { label: "Dominio", amount: 2 },
];

export type CostBreakdown = {
  replies: number;
  voice: number;
  websites: number;
  diagnosis: number;
  images: number;
};

export type LineRow = {
  businessId: string;
  name: string;
  model: string;
  replies: number;
  replyCost: number;
};

export type AccountRow = {
  key: string;
  userId: string | null;
  name: string;
  email: string | null;
  planTier: PlanTier;
  planLabel: string;
  active: boolean;
  listPriceUsd: number;
  customPriceUsd: number | null;
  planRevenue: number;
  addonRevenue: number;
  revenue: number;
  fees: number;
  aiCost: number;
  breakdown: CostBreakdown;
  profit: number;
  margin: number | null;
  contacts: number;
  contactLimit: number | null;
  costPerContact: number | null;
  lines: LineRow[];
};

export type ProfitabilityReport = {
  month: string; // YYYY-MM
  isCurrentMonth: boolean;
  monthProgress: number; // 0..1 of the month elapsed (1 for past months)
  accounts: AccountRow[];
  totals: {
    revenue: number;
    fees: number;
    aiCost: number;
    fixedCosts: number;
    profit: number;
    margin: number | null;
    breakdown: CostBreakdown;
    payingAccounts: number;
    contacts: number;
  };
};

const TIER_RANK: Record<PlanTier, number> = { STARTER: 0, PRO: 1, SCALE: 2 };

export function parseMonth(value: string | undefined, now: Date): { start: Date; end: Date; key: string } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end, key: `${year}-${String(month + 1).padStart(2, "0")}` };
}

function emptyBreakdown(): CostBreakdown {
  return { replies: 0, voice: 0, websites: 0, diagnosis: 0, images: 0 };
}

function addBreakdown(into: CostBreakdown, from: CostBreakdown): void {
  into.replies += from.replies;
  into.voice += from.voice;
  into.websites += from.websites;
  into.diagnosis += from.diagnosis;
  into.images += from.images;
}

function sumBreakdown(b: CostBreakdown): number {
  return b.replies + b.voice + b.websites + b.diagnosis + b.images;
}

export async function getProfitabilityReport(adminUserId: string, monthParam: string | undefined, now = new Date()): Promise<ProfitabilityReport> {
  const { start, end, key } = parseMonth(monthParam, now);
  const isCurrentMonth = now >= start && now < end;
  const monthProgress = isCurrentMonth ? Math.max(0.01, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) : 1;

  const adminMemberships = await prisma.membership.findMany({
    where: { userId: adminUserId, role: "ADMIN" },
    select: { businessId: true },
  });
  const businessIds = adminMemberships.map((m) => m.businessId);

  const businesses = businessIds.length
    ? await prisma.business.findMany({
        where: { id: { in: businessIds } },
        select: {
          id: true,
          name: true,
          planTier: true,
          subscriptionStartedAt: true,
          subscriptionEndsAt: true,
          agent: { select: { model: true } },
          memberships: {
            where: { role: "OWNER" },
            select: { user: { select: { id: true, name: true, email: true, monthlyPriceUsd: true } } },
            take: 1,
          },
        },
      })
    : [];

  // ---- AI cost per business ------------------------------------------------
  const replyRows = businessIds.length
    ? await prisma.$queryRaw<
        { businessId: string; model: string; replies: bigint; input: bigint; output: bigint; cacheWrite: bigint; cacheRead: bigint }[]
      >`SELECT c."businessId", m."model",
          COUNT(*) AS "replies",
          COALESCE(SUM(m."inputTokens"), 0) AS "input",
          COALESCE(SUM(m."outputTokens"), 0) AS "output",
          COALESCE(SUM(m."cacheCreationInputTokens"), 0) AS "cacheWrite",
          COALESCE(SUM(m."cacheReadInputTokens"), 0) AS "cacheRead"
        FROM "Message" m
        JOIN "Conversation" c ON c."id" = m."conversationId"
        WHERE c."businessId" IN (${Prisma.join(businessIds)})
          AND m."model" IS NOT NULL
          AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
        GROUP BY c."businessId", m."model"`
    : [];

  const usageRows = businessIds.length
    ? await prisma.aiUsage.groupBy({
        by: ["businessId", "kind"],
        where: { businessId: { in: businessIds }, createdAt: { gte: start, lt: end } },
        _sum: { costUsd: true },
      })
    : [];

  const contactRows = businessIds.length
    ? await prisma.$queryRaw<{ businessId: string; contacts: bigint }[]>`
        SELECT c."businessId", COUNT(DISTINCT m."conversationId") AS "contacts"
        FROM "Message" m
        JOIN "Conversation" c ON c."id" = m."conversationId"
        WHERE c."businessId" IN (${Prisma.join(businessIds)})
          AND m."role" = 'CUSTOMER'
          AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
        GROUP BY c."businessId"`
    : [];

  const costByBusiness = new Map<string, CostBreakdown>();
  const repliesByBusiness = new Map<string, { replies: number; cost: number }>();
  const breakdownFor = (id: string) => {
    let b = costByBusiness.get(id);
    if (!b) costByBusiness.set(id, (b = emptyBreakdown()));
    return b;
  };
  for (const r of replyRows) {
    const cost =
      estimateCostUsd({
        model: r.model,
        inputTokens: Number(r.input),
        outputTokens: Number(r.output),
        cacheCreationInputTokens: Number(r.cacheWrite),
        cacheReadInputTokens: Number(r.cacheRead),
      }) ?? 0;
    breakdownFor(r.businessId).replies += cost;
    const prev = repliesByBusiness.get(r.businessId) ?? { replies: 0, cost: 0 };
    repliesByBusiness.set(r.businessId, { replies: prev.replies + Number(r.replies), cost: prev.cost + cost });
  }
  for (const u of usageRows) {
    const cost = u._sum.costUsd ?? 0;
    const b = breakdownFor(u.businessId);
    if (u.kind === "VOICE_IN" || u.kind === "VOICE_OUT") b.voice += cost;
    else if (u.kind === "WEBSITE") b.websites += cost;
    else if (u.kind === "DIAGNOSIS") b.diagnosis += cost;
    else if (u.kind === "IMAGE") b.images += cost;
  }
  const contactsByBusiness = new Map(contactRows.map((r) => [r.businessId, Number(r.contacts)]));

  // ---- Group lines into accounts --------------------------------------------
  type Group = { key: string; userId: string | null; name: string; email: string | null; customPrice: number | null; items: typeof businesses };
  const groups = new Map<string, Group>();
  for (const b of businesses) {
    const owner = b.memberships[0]?.user ?? null;
    const groupKey = owner ? `u:${owner.id}` : `b:${b.id}`;
    let g = groups.get(groupKey);
    if (!g) {
      g = {
        key: groupKey,
        userId: owner?.id ?? null,
        name: owner?.name || b.name,
        email: owner?.email ?? null,
        customPrice: owner?.monthlyPriceUsd ?? null,
        items: [],
      };
      groups.set(groupKey, g);
    }
    g.items.push(b);
  }

  const ownerIds = [...groups.values()].map((g) => g.userId).filter((id): id is string => !!id);
  const addons = ownerIds.length
    ? await prisma.accountAddon.findMany({
        where: { userId: { in: ownerIds }, status: "ACTIVE", activatedAt: { gte: start, lt: end } },
        select: { userId: true, priceCop: true, source: true },
      })
    : [];

  const accounts: AccountRow[] = [];
  for (const g of groups.values()) {
    const tier = g.items.reduce<PlanTier>((best, b) => (TIER_RANK[b.planTier] > TIER_RANK[best] ? b.planTier : best), "STARTER");
    // Paying during this month unless every line's subscription ended
    // before the month started, or started after it ended.
    const active = g.items.some(
      (b) => (!b.subscriptionEndsAt || b.subscriptionEndsAt >= start) && (!b.subscriptionStartedAt || b.subscriptionStartedAt < end),
    );
    const listPriceUsd = PLAN_PRICE_USD[tier];
    // A line with no owner is internal (demo, agency's own test) — nobody
    // pays for it. The agency's own account can be set to 0 from the page.
    const planRevenue = active && g.userId ? (g.customPrice ?? listPriceUsd) : 0;
    const accountAddons = addons.filter((a) => a.userId === g.userId);
    const addonRevenue = accountAddons.reduce((sum, a) => sum + a.priceCop / COP_PER_USD, 0);
    const fees =
      planRevenue * MERCADOPAGO_FEE_RATE +
      accountAddons.filter((a) => a.source === "MERCADOPAGO").reduce((sum, a) => sum + (a.priceCop / COP_PER_USD) * MERCADOPAGO_FEE_RATE, 0);

    const breakdown = emptyBreakdown();
    let contacts = 0;
    const lines: LineRow[] = [];
    for (const b of g.items) {
      addBreakdown(breakdown, costByBusiness.get(b.id) ?? emptyBreakdown());
      contacts += contactsByBusiness.get(b.id) ?? 0;
      const r = repliesByBusiness.get(b.id);
      lines.push({ businessId: b.id, name: b.name, model: b.agent?.model ?? "claude-sonnet-5", replies: r?.replies ?? 0, replyCost: r?.cost ?? 0 });
    }
    const aiCost = sumBreakdown(breakdown);
    const revenue = planRevenue + addonRevenue;
    const profit = revenue - fees - aiCost;

    accounts.push({
      key: g.key,
      userId: g.userId,
      name: g.name,
      email: g.email,
      planTier: tier,
      planLabel: PLAN_LABELS[tier],
      active,
      listPriceUsd,
      customPriceUsd: g.customPrice,
      planRevenue,
      addonRevenue,
      revenue,
      fees,
      aiCost,
      breakdown,
      profit,
      margin: revenue > 0 ? profit / revenue : null,
      contacts,
      contactLimit: PLAN_LIMITS[tier],
      costPerContact: contacts > 0 ? aiCost / contacts : null,
      lines: lines.sort((a, b) => b.replyCost - a.replyCost),
    });
  }

  // Least profitable first: that's what the agency needs to look at.
  accounts.sort((a, b) => (a.margin ?? -Infinity) - (b.margin ?? -Infinity) || b.aiCost - a.aiCost);

  const totalsBreakdown = emptyBreakdown();
  for (const a of accounts) addBreakdown(totalsBreakdown, a.breakdown);
  const revenue = accounts.reduce((s, a) => s + a.revenue, 0);
  const fees = accounts.reduce((s, a) => s + a.fees, 0);
  const aiCost = sumBreakdown(totalsBreakdown);
  const fixedCosts = FIXED_COSTS_USD.reduce((s, c) => s + c.amount, 0);
  const profit = revenue - fees - aiCost - fixedCosts;

  return {
    month: key,
    isCurrentMonth,
    monthProgress,
    accounts,
    totals: {
      revenue,
      fees,
      aiCost,
      fixedCosts,
      profit,
      margin: revenue > 0 ? profit / revenue : null,
      breakdown: totalsBreakdown,
      payingAccounts: accounts.filter((a) => a.planRevenue > 0).length,
      contacts: accounts.reduce((s, a) => s + a.contacts, 0),
    },
  };
}
