import { prisma } from "@/lib/prisma";
import { resolveDateRange, type DateRangeKey } from "@/lib/analytics";

// "Ventas" KPIs: what the business actually sold, from the sales its team
// registers in the CRM (see Sale in schema.prisma). aiAssisted marks a sale
// whose conversation the AI had answered — the "tu agente generó $X" number.

export type SalesSummary = {
  // The currency of the figures below: the one most of the period's sales used.
  currency: string;
  // Sales in any other currency are not added to those figures (US$97 is not $97
  // pesos): they are listed apart, each in its own currency.
  otherCurrencies: { currency: string; revenue: number; count: number }[];
  revenue: number;
  count: number;
  avgTicket: number | null;
  // Sales in the period over new contacts in the period.
  closeRate: number | null;
  aiRevenue: number;
  aiCount: number;
  // Same-length period right before, for the "vs. antes" delta.
  previousRevenue: number;
  topProducts: { name: string; count: number; revenue: number }[];
  // Product "Pedir por WhatsApp" clicks on the business's web catalog.
  productClicks: { name: string; clicks: number }[];
  recent: {
    id: string;
    amount: number;
    productName: string | null;
    quantity: number;
    customer: string | null;
    conversationId: string | null;
    aiAssisted: boolean;
    closedAt: Date;
  }[];
};

export async function getSalesSummary(businessId: string, rangeKey: DateRangeKey, now = new Date()): Promise<SalesSummary> {
  const { since, until } = resolveDateRange(rangeKey, now);
  const length = until.getTime() - since.getTime();
  const previousSince = new Date(since.getTime() - length);

  const [allSales, newContacts, clicks] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, closedAt: { gte: since, lt: until } },
      orderBy: { closedAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        productName: true,
        quantity: true,
        aiAssisted: true,
        closedAt: true,
        conversationId: true,
        conversation: { select: { customerName: true, customerPhone: true } },
      },
    }),
    prisma.conversation.count({ where: { businessId, createdAt: { gte: since, lt: until } } }),
    prisma.websiteEvent.groupBy({
      by: ["label"],
      where: { type: "cta_click", label: { startsWith: "pedido:" }, createdAt: { gte: since, lt: until }, website: { businessId } },
      _count: true,
    }),
  ]);

  // The main currency: the one with the most sales (the latest wins a tie).
  const tally = new Map<string, number>();
  for (const s of allSales) tally.set(s.currency, (tally.get(s.currency) ?? 0) + 1);
  const currency = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "COP";
  const sales = allSales.filter((s) => s.currency === currency);
  const otherTotals = new Map<string, { revenue: number; count: number }>();
  for (const s of allSales) {
    if (s.currency === currency) continue;
    const row = otherTotals.get(s.currency) ?? { revenue: 0, count: 0 };
    row.revenue += s.amount;
    row.count += 1;
    otherTotals.set(s.currency, row);
  }
  const previous = await prisma.sale.aggregate({ where: { businessId, currency, closedAt: { gte: previousSince, lt: since } }, _sum: { amount: true } });

  const revenue = sales.reduce((sum, s) => sum + s.amount, 0);
  const ai = sales.filter((s) => s.aiAssisted);

  const byProduct = new Map<string, { count: number; revenue: number }>();
  for (const s of sales) {
    const name = s.productName?.trim() || "Sin producto";
    const row = byProduct.get(name) ?? { count: 0, revenue: 0 };
    row.count += s.quantity;
    row.revenue += s.amount;
    byProduct.set(name, row);
  }

  return {
    currency,
    otherCurrencies: [...otherTotals.entries()].map(([code, v]) => ({ currency: code, ...v })),
    revenue,
    count: sales.length,
    avgTicket: sales.length ? Math.round(revenue / sales.length) : null,
    closeRate: newContacts ? (sales.length / newContacts) * 100 : null,
    aiRevenue: ai.reduce((sum, s) => sum + s.amount, 0),
    aiCount: ai.length,
    previousRevenue: previous._sum.amount ?? 0,
    topProducts: [...byProduct.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    productClicks: clicks
      .map((c) => ({ name: (c.label ?? "").slice("pedido:".length), clicks: c._count }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5),
    recent: sales.slice(0, 6).map((s) => ({
      id: s.id,
      amount: s.amount,
      productName: s.productName,
      quantity: s.quantity,
      customer: s.conversation ? s.conversation.customerName || s.conversation.customerPhone : null,
      conversationId: s.conversationId,
      aiAssisted: s.aiAssisted,
      closedAt: s.closedAt,
    })),
  };
}
