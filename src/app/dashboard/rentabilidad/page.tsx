import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAgencyAdmin } from "@/lib/authz";
import { FIXED_COSTS_USD, getProfitabilityReport, parseMonth, type AccountRow, type CostBreakdown } from "@/lib/profitability";
import { ModelSelect, PriceCell } from "./ProfitControls";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdRound = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function money(n: number): string {
  return Math.abs(n) >= 1000 ? usdRound.format(n) : usd.format(n);
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function lastMonths(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

// Healthy ≥ 50% (the target we price packs at), watch 30–50%, losing < 30%.
function marginTone(margin: number | null): { cls: string; label: string } {
  if (margin === null) return { cls: "bg-surface text-ink-muted", label: "Sin ingreso" };
  if (margin >= 0.5) return { cls: "bg-accent/15 text-accent", label: "Rentable" };
  if (margin >= 0.3) return { cls: "bg-[#fab219]/15 text-[#d99a00]", label: "Vigilar" };
  return { cls: "bg-error/15 text-error", label: margin < 0 ? "Pierde dinero" : "Margen bajo" };
}

const BREAKDOWN_LABELS: { key: keyof CostBreakdown; label: string; color: string }[] = [
  { key: "replies", label: "Respuestas por WhatsApp", color: "var(--color-accent)" },
  { key: "voice", label: "Notas de voz", color: "#5b8def" },
  { key: "websites", label: "Sitios web", color: "#b07cf0" },
  { key: "diagnosis", label: "Diagnósticos", color: "#fab219" },
  { key: "images", label: "Imágenes", color: "#ef6b8a" },
];

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="fl-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone === "bad" ? "text-error" : tone === "good" ? "text-accent" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function CostBar({ breakdown, total }: { breakdown: CostBreakdown; total: number }) {
  if (total <= 0) return <div className="h-2 rounded-full bg-border" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-border">
      {BREAKDOWN_LABELS.map((b) =>
        breakdown[b.key] > 0 ? <div key={b.key} style={{ width: `${(breakdown[b.key] / total) * 100}%`, background: b.color }} /> : null,
      )}
    </div>
  );
}

function AccountCard({ a }: { a: AccountRow }) {
  const tone = marginTone(a.margin);
  const usagePct = a.contactLimit ? Math.min(100, (a.contacts / a.contactLimit) * 100) : null;
  return (
    <div className="fl-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{a.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {a.email ?? "Sin dueño asignado (no cuenta como ingreso)"} · Plan {a.planLabel}
            {!a.active && " · membresía vencida"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.cls}`}>
          {tone.label} · {pct(a.margin)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-muted">Ingreso</dt>
          <dd className="font-semibold tabular-nums">{money(a.revenue)}</dd>
          {a.addonRevenue > 0 && <dd className="text-xs text-ink-muted tabular-nums">incl. {money(a.addonRevenue)} en paquetes</dd>}
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Costo de IA</dt>
          <dd className="font-semibold tabular-nums">{money(a.aiCost)}</dd>
          <dd className="text-xs text-ink-muted tabular-nums">+ {money(a.fees)} comisiones</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Ganancia</dt>
          <dd className={`font-semibold tabular-nums ${a.profit < 0 ? "text-error" : "text-ink"}`}>{money(a.profit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Clientes atendidos</dt>
          <dd className="font-semibold tabular-nums">
            {a.contacts.toLocaleString("es-CO")}
            <span className="font-normal text-ink-muted"> / {a.contactLimit?.toLocaleString("es-CO") ?? "∞"}</span>
          </dd>
          <dd className="text-xs text-ink-muted tabular-nums">{a.costPerContact === null ? "—" : `${usd.format(a.costPerContact)} c/u`}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1.5">
        {usagePct !== null && (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${usagePct >= 100 ? "bg-error" : usagePct >= 80 ? "bg-[#fab219]" : "bg-accent"}`}
                style={{ width: `${Math.max(usagePct, 1)}%` }}
              />
            </div>
            <p className="text-xs text-ink-faint">Ha usado el {Math.round(usagePct)}% de su cupo de clientes atendidos por IA</p>
          </>
        )}
        {a.aiCost > 0 && (
          <p className="text-xs text-ink-muted">
            Gasto de IA:{" "}
            {BREAKDOWN_LABELS.filter((b) => a.breakdown[b.key] > 0)
              .map((b) => `${b.label} ${usd.format(a.breakdown[b.key])}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
        {a.userId ? (
          <div>
            <p className="mb-1 text-xs text-ink-muted">Paga al mes (vacío = precio del plan, 0 = cuenta interna)</p>
            <PriceCell userId={a.userId} customPrice={a.customPriceUsd} listPrice={a.listPriceUsd} />
          </div>
        ) : (
          <span />
        )}
        <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
          {a.lines.map((line) => (
            <div key={line.businessId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-ink">{line.name}</p>
                <p className="text-xs text-ink-muted tabular-nums">
                  {line.replies.toLocaleString("es-CO")} respuestas · {usd.format(line.replyCost)}
                </p>
              </div>
              <ModelSelect businessId={line.businessId} model={line.model} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function RentabilidadPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !(await isAgencyAdmin(session.user.id))) notFound();
  const { mes } = await searchParams;
  const now = new Date();
  const report = await getProfitabilityReport(session.user.id, mes, now);
  const { totals } = report;
  const selected = parseMonth(mes, now).key;
  const projectedAi = report.isCurrentMonth ? totals.aiCost / report.monthProgress : null;
  const losing = report.accounts.filter((a) => a.margin !== null && a.margin < 0.3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Rentabilidad</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Lo que te deja cada cliente: lo que paga menos lo que gasta en IA (respuestas, notas de voz, sitios y
            diagnósticos) y las comisiones de cobro. Lo que cobra Meta por WhatsApp lo paga cada cliente en su cuenta.
          </p>
        </div>
        <nav aria-label="Mes" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 [scrollbar-width:none]">
          {lastMonths(now, 6)
            .reverse()
            .map((key) => (
              <Link
                key={key}
                href={`/dashboard/rentabilidad?mes=${key}`}
                aria-current={key === selected ? "page" : undefined}
                className={`flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  key === selected ? "bg-accent text-accent-ink shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                {monthLabel(key).split(" ")[0].slice(0, 3)}
              </Link>
            ))}
        </nav>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Ingresos" value={money(totals.revenue)} hint={`${totals.payingAccounts} clientes pagando`} />
        <Tile
          label="Costo de IA"
          value={money(totals.aiCost)}
          hint={projectedAi !== null ? `Proyección a fin de mes: ${money(projectedAi)}` : `${totals.contacts.toLocaleString("es-CO")} clientes atendidos`}
        />
        <Tile label="Comisiones" value={money(totals.fees)} hint="Mercado Pago, ~4% (estimado)" />
        <Tile label="Gastos fijos" value={money(totals.fixedCosts)} hint="Herramientas del mes" />
        <Tile
          label="Ganancia neta"
          value={money(totals.profit)}
          hint={`Margen ${pct(totals.margin)}`}
          tone={totals.profit < 0 ? "bad" : "good"}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="fl-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">En qué se va el gasto de IA · {monthLabel(report.month)}</h2>
          <div className="mt-3">
            <CostBar breakdown={totals.breakdown} total={totals.aiCost} />
          </div>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {BREAKDOWN_LABELS.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-ink-muted">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: b.color }} />
                  {b.label}
                </span>
                <span className="tabular-nums text-ink">{usd.format(totals.breakdown[b.key])}</span>
              </li>
            ))}
          </ul>
          {totals.contacts > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-ink-muted">
              Costo promedio por cliente atendido: <span className="font-semibold text-ink">{usd.format(totals.aiCost / totals.contacts)}</span>. Para
              recargar Anthropic y OpenAI, toma el costo de IA proyectado y súmale un 30% de colchón.
            </p>
          )}
        </div>
        <div className="fl-card p-4">
          <h2 className="text-sm font-semibold text-ink">Gastos fijos</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {FIXED_COSTS_USD.map((c) => (
              <li key={c.label} className="flex justify-between gap-2">
                <span className="text-ink-muted">{c.label}</span>
                <span className="tabular-nums">{usd.format(c.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">¿Cambió algún gasto? Pídelo y se actualiza aquí.</p>
        </div>
      </section>

      {losing.length > 0 && (
        <section className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm">
          <p className="font-semibold text-error">
            {losing.length === 1 ? "1 cliente deja" : `${losing.length} clientes dejan`} menos del 30% de margen este mes
          </p>
          <p className="mt-1 text-ink-muted">
            Opciones: pasarlo al modelo económico (Haiku), ofrecerle un paquete o un plan mayor, o revisar su precio.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Por cliente · menos rentable primero</h2>
        {report.accounts.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no hay clientes.</p>
        ) : (
          report.accounts.map((a) => <AccountCard key={a.key} a={a} />)
        )}
      </section>
    </div>
  );
}
