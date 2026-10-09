import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { daysOfStockLeft } from "@/lib/inventory";
import { InventoryList, type InventoryRow } from "./InventoryList";

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 86_400_000);
}

export default async function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true } } },
  });
  if (!membership) notFound();

  const [products, sold] = await Promise.all([
    // Services don't run out, so they never show up here.
    prisma.product.findMany({
      where: { businessId: id, kind: "PRODUCT" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, category: true, imageUrl: true, active: true, trackStock: true, stock: true, lowStockAt: true },
    }),
    prisma.sale.groupBy({
      by: ["productId"],
      where: { businessId: id, productId: { not: null }, closedAt: { gte: thirtyDaysAgo() } },
      _sum: { quantity: true },
    }),
  ]);
  const soldById = new Map(sold.map((s) => [s.productId, s._sum.quantity ?? 0]));

  const rows: InventoryRow[] = products.map((p) => {
    const sold30 = soldById.get(p.id) ?? 0;
    return { ...p, sold30, daysLeft: p.trackStock ? daysOfStockLeft(p.stock, sold30) : null };
  });
  const tracked = rows.filter((r) => r.trackStock);
  const soldOut = tracked.filter((r) => r.stock <= 0).length;
  const low = tracked.filter((r) => r.stock > 0 && r.stock <= r.lowStockAt).length;
  const units = tracked.reduce((sum, r) => sum + r.stock, 0);

  const tiles = [
    { label: "Con inventario", value: tracked.length, hint: `de ${rows.length} productos`, tone: "text-ink" },
    { label: "Unidades disponibles", value: units, hint: "sumando todos", tone: "text-ink" },
    { label: "Por agotarse", value: low, hint: "llegaron a tu aviso", tone: low ? "text-[var(--status-warn)]" : "text-ink" },
    { label: "Agotados", value: soldOut, hint: "no se ofrecen", tone: soldOut ? "text-error" : "text-ink" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Inventario</h1>
        <p className="max-w-prose text-sm text-ink-muted">
          Cada venta que registras en el CRM descuenta unidades. Te avisamos cuando algo se esté acabando, y lo agotado no se ofrece
          ni en tu web ni por tu agente. Si vendes también por fuera (tienda física, otra app), usa <strong className="text-ink">Ajustar</strong>.
        </p>
      </div>

      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="fl-card p-4">
              <dt className="text-xs font-medium text-ink-muted">{t.label}</dt>
              <dd className={`fl-mono mt-1 text-2xl font-bold tabular-nums ${t.tone}`}>{t.value.toLocaleString("es-CO")}</dd>
              <dd className="text-[11px] text-ink-faint">{t.hint}</dd>
            </div>
          ))}
        </dl>
      )}

      <InventoryList businessId={id} rows={rows} />
    </div>
  );
}
