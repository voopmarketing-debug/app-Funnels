import Link from "next/link";
import type { SalesSummary } from "@/lib/salesMetrics";
import { formatMoney } from "@/lib/websiteContentV2";
import { StatTile } from "./StatTile";
import { BagIcon, FunnelIcon, SalesIcon, TicketIcon } from "./StatIcons";

function closeRateStatus(rate: number | null): "good" | "warning" | "critical" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= 15) return "good";
  if (rate >= 5) return "warning";
  return "critical";
}

function delta(current: number, previous: number): string | undefined {
  if (previous === 0) return current > 0 ? "Primer período con ventas" : undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs. período anterior`;
}

function BarList({ rows, format }: { rows: { name: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{r.name}</span>
            <span className="fl-mono flex-none font-semibold tabular-nums text-ink">{format(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Ventas" on the KPIs page: what the business sold, from the sales its team
 * registers in the CRM, and how much of it came through chats the AI
 * answered — the "tu agente generó $X" number.
 */
export function SalesSection({ businessId, summary, period }: { businessId: string; summary: SalesSummary; period: string }) {
  const money = (v: number) => formatMoney(v, summary.currency);
  const crmHref = `/dashboard/businesses/${businessId}/crm`;
  const aiShare = summary.revenue > 0 ? Math.round((summary.aiRevenue / summary.revenue) * 100) : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Ventas</h2>
          <p className="text-sm text-ink-muted">Lo que vendiste por WhatsApp y cuánto generó tu agente de IA · {period}</p>
        </div>
        <Link href={crmHref} className="text-sm font-semibold text-accent hover:underline">
          Registrar una venta en el CRM →
        </Link>
      </div>

      {summary.count === 0 ? (
        <div className="fl-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent/15 text-xl" aria-hidden="true">
            💰
          </span>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-ink">Todavía no hay ventas registradas en este período</p>
            <p className="text-sm text-ink-muted">
              Cuando un cliente te compre, ábrelo en el CRM y toca <strong className="text-ink">💰 Registrar venta</strong>, o pásalo a
              tu etapa de &quot;Ganado&quot;. Aquí verás tus ingresos, tu ticket promedio y cuánto vendió tu agente de IA.
            </p>
          </div>
          <Link
            href={crmHref}
            className="flex-none rounded-lg bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Ir al CRM
          </Link>
        </div>
      ) : (
        <>
          {summary.aiCount > 0 && (
            <div className="fl-card-hero flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                <span aria-hidden="true">🤖 </span>Tu agente de IA atendió las conversaciones de{" "}
                <strong className="text-ink">
                  {summary.aiCount} {summary.aiCount === 1 ? "venta" : "ventas"}
                </strong>{" "}
                ({aiShare}% de tus ingresos)
              </p>
              <p className="fl-mono text-2xl font-bold tabular-nums text-accent sm:text-3xl">{money(summary.aiRevenue)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile
              label="Ingresos"
              hint="Suma de las ventas registradas"
              value={money(summary.revenue)}
              sublabel={delta(summary.revenue, summary.previousRevenue)}
              description="La suma de todas las ventas que registraste en el CRM en el período. La flecha compara con el período anterior del mismo largo."
              tone="accent"
              icon={<SalesIcon />}
            />
            <StatTile
              label="Ventas"
              hint="Cuántas compras se cerraron"
              value={summary.count.toLocaleString("es-CO")}
              description="Número de ventas registradas en el período, desde la ficha del contacto o al pasarlo a una etapa de ganado."
              tone="blue"
              icon={<BagIcon />}
            />
            <StatTile
              label="Ticket promedio"
              hint="Lo que deja cada venta en promedio"
              value={summary.avgTicket === null ? "—" : money(summary.avgTicket)}
              description="Ingresos divididos entre el número de ventas. Subirlo (combos, adicionales, planes más completos) es la forma más rápida de vender más sin conseguir más clientes."
              tone="amber"
              icon={<TicketIcon />}
            />
            <StatTile
              label="Tasa de cierre"
              hint="De cada 100 clientes nuevos, cuántos compran"
              value={summary.closeRate === null ? "—" : `${Math.round(summary.closeRate)}%`}
              status={closeRateStatus(summary.closeRate)}
              goal="Meta: 15% o más"
              description="Ventas del período divididas entre las personas que te escribieron por primera vez en el mismo período."
              tone="secondary"
              icon={<FunnelIcon />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="fl-card min-w-0 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-ink">Lo que más vendes</h3>
              <p className="mb-4 mt-0.5 text-xs text-ink-muted">Productos y servicios ordenados por ingresos.</p>
              <BarList rows={summary.topProducts.map((p) => ({ name: `${p.name} · ${p.count}`, value: p.revenue }))} format={money} />
            </div>
            <div className="fl-card min-w-0 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-ink">Últimas ventas</h3>
              <p className="mb-3 mt-0.5 text-xs text-ink-muted">Toca una para abrir la conversación.</p>
              <ul className="divide-y divide-border">
                {summary.recent.map((s) => {
                  const body = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{s.customer ?? "Cliente"}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {s.quantity > 1 ? `${s.quantity} × ` : ""}
                          {s.productName ?? "Venta"} ·{" "}
                          {s.closedAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" })}
                          {s.aiAssisted && <span className="text-accent"> · con IA</span>}
                        </p>
                      </div>
                      <span className="fl-mono flex-none text-sm font-semibold tabular-nums text-ink">{money(s.amount)}</span>
                    </>
                  );
                  return (
                    <li key={s.id}>
                      {s.conversationId ? (
                        <Link
                          href={`/dashboard/businesses/${businessId}/conversations/${s.conversationId}`}
                          className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-surface-2"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      {summary.productClicks.length > 0 && (
        <div className="fl-card min-w-0 p-4 md:p-5">
          <h3 className="text-sm font-semibold text-ink">Los más pedidos desde tu web</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-muted">Clics en &quot;Pedir por WhatsApp&quot; de cada producto de tu catálogo.</p>
          <BarList rows={summary.productClicks.map((p) => ({ name: p.name, value: p.clicks }))} format={(v) => `${v} ${v === 1 ? "clic" : "clics"}`} />
        </div>
      )}
    </section>
  );
}
