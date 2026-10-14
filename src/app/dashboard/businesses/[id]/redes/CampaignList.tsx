"use client";

import { useMemo, useState } from "react";
import type { CampaignOutcome, CampaignTip, CampaignVerdict } from "@/lib/adsAdvice";
import { moneyFormatter, shortDate } from "./format";
import { Pager, downloadCsv, toolbarButton, toolbarInput, usePaged } from "./tables";

// Every campaign as a card a business owner can read in five seconds: is it
// worth it (the verdict), what did it cost and what came back, and the one
// thing to do about it. The technical numbers wait behind "Ver detalles".

export type CampaignCard = {
  id: string;
  name: string;
  status: string | null;
  objective: string;
  spend: number;
  /** Share of the spend of every campaign listed, 0-1. */
  share: number;
  outcome: CampaignOutcome;
  verdict: CampaignVerdict;
  verdictLabel: string;
  tips: CampaignTip[];
  linkCtr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  reach: number;
  impressions: number;
  roas: number | null;
  updatedAt: string | null;
};

const VERDICT_STYLE: Record<CampaignVerdict, { bg: string; fg: string; dot: string }> = {
  escalar: { bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)", dot: "#0ca30c" },
  mantener: { bg: "rgba(12,163,12,0.08)", fg: "var(--status-good)", dot: "#0ca30c" },
  optimizar: { bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)", dot: "#fab219" },
  pausar: { bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)", dot: "#d03b3b" },
  poco_dato: { bg: "rgba(138,138,134,0.14)", fg: "var(--ink-muted)", dot: "#8a8a86" },
};
const TIP_DOT = { good: "#0ca30c", warn: "#fab219", bad: "#d03b3b" };
const VERDICT_ORDER: CampaignVerdict[] = ["pausar", "optimizar", "escalar", "mantener", "poco_dato"];

const STATUS: Record<string, { label: string; on: boolean }> = {
  ACTIVE: { label: "Encendida", on: true },
  PAUSED: { label: "Apagada", on: false },
  CAMPAIGN_PAUSED: { label: "Apagada", on: false },
  ADSET_PAUSED: { label: "Apagada", on: false },
  ARCHIVED: { label: "Archivada", on: false },
  DELETED: { label: "Eliminada", on: false },
  IN_PROCESS: { label: "En revisión", on: false },
  WITH_ISSUES: { label: "Con problemas", on: false },
};

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "fix", label: "Revisar" },
  { key: "good", label: "Van bien" },
  { key: "on", label: "Encendidas" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "attention", label: "Primero las que necesitan atención" },
  { key: "spend", label: "Más inversión primero" },
  { key: "cheap", label: "Más baratas primero" },
  { key: "recent", label: "Editadas hace poco" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

const matches = (c: CampaignCard, f: Filter) =>
  f === "all" ||
  (f === "fix" && (c.verdict === "pausar" || c.verdict === "optimizar")) ||
  (f === "good" && (c.verdict === "escalar" || c.verdict === "mantener")) ||
  (f === "on" && c.status === "ACTIVE");

const n0 = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));
const dec = (n: number | null, digits = 1) => (n == null ? "—" : n.toFixed(digits).replace(".", ","));

function Card({ c, money }: { c: CampaignCard; money: (n: number | null | undefined) => string }) {
  const style = VERDICT_STYLE[c.verdict];
  const status = c.status ? STATUS[c.status] : null;
  const [main, ...more] = c.tips;
  const got = c.outcome.count;
  const details: [string, string][] = [
    ["De cada 100 que lo vieron, hicieron clic", c.linkCtr == null ? "—" : `${dec(c.linkCtr, 2)}`],
    ["Cada clic a tu enlace costó", money(c.cpc)],
    ["Mostrarlo 1.000 veces costó", money(c.cpm)],
    ["Veces que cada persona lo vio", dec(c.frequency)],
    ["Personas que lo vieron", n0(c.reach)],
    ["Veces que se mostró", n0(c.impressions)],
    ...(c.roas != null ? ([["Ventas por cada $1 invertido", `${dec(c.roas)}x`]] as [string, string][]) : []),
    ...(c.updatedAt ? ([["Última edición", shortDate(c.updatedAt)]] as [string, string][]) : []),
  ];

  return (
    <article className="fl-card min-w-0 space-y-4 p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-start">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: style.bg, color: style.fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
              {c.verdictLabel}
            </span>
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.on ? "#0ca30c" : "#8a8a86" }} />
                {status.label}
              </span>
            )}
          </div>
          <h4 className="line-clamp-2 break-words font-semibold leading-snug text-ink [overflow-wrap:anywhere]" title={c.name}>
            {c.name}
          </h4>
          <p className="text-xs text-ink-muted">Buscaba {c.outcome.goal}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-3 sm:gap-2">
          <div className="min-w-0">
            <dt className="text-xs text-ink-muted">Invertiste</dt>
            <dd className="text-base font-bold tabular-nums text-ink md:text-lg">{money(c.spend)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-muted">Conseguiste</dt>
            <dd className="text-base font-bold tabular-nums text-ink md:text-lg">
              {got == null ? "—" : n0(got)}
              {got != null && <span className="block text-xs font-normal text-ink-muted">{got === 1 ? c.outcome.singular : c.outcome.plural}</span>}
            </dd>
          </div>
          <div className="col-span-2 min-w-0 border-t border-border pt-2 sm:col-span-1 sm:border-0 sm:pt-0">
            <dt className="text-xs text-ink-muted">{c.outcome.costLabel}</dt>
            <dd className="text-base font-bold tabular-nums text-ink md:text-lg">{c.outcome.cost == null ? "—" : money(c.outcome.cost)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.round(c.share * 100))}%`, background: "var(--series-fb)" }} />
        </div>
        <span className="flex-none tabular-nums">{Math.round(c.share * 100)}% de lo que invertiste</span>
      </div>

      {main && (
        <p className="flex gap-2.5 rounded-xl border border-border p-3 text-sm leading-relaxed text-ink">
          <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: TIP_DOT[main.tone] }} />
          <span>{main.text}</span>
        </p>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink-muted hover:text-ink">
          <span className="group-open:hidden">Ver detalles ›</span>
          <span className="hidden group-open:inline">Ocultar detalles</span>
        </summary>
        <div className="mt-3 space-y-3">
          {more.length > 0 && (
            <ul className="space-y-2">
              {more.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: TIP_DOT[t.tone] }} />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="font-semibold tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </article>
  );
}

export function CampaignList({ campaigns, currency }: { campaigns: CampaignCard[]; currency: string }) {
  const money = moneyFormatter(currency);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("attention");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = campaigns.filter((c) => matches(c, filter) && (!q || c.name.toLowerCase().includes(q)));
    const cost = (c: CampaignCard) => c.outcome.cost ?? Number.POSITIVE_INFINITY;
    return list.sort((a, b) =>
      sort === "spend"
        ? b.spend - a.spend
        : sort === "cheap"
          ? cost(a) - cost(b) || b.spend - a.spend
          : sort === "recent"
            ? (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
            : VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || b.spend - a.spend,
    );
  }, [campaigns, filter, sort, query]);
  const { page, pages, visible, setPage } = usePaged(rows, `${filter}|${sort}|${query}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Mostrar" className="fl-seg">
          {FILTERS.map((f) => {
            const count = campaigns.filter((c) => matches(c, f.key)).length;
            return (
              <button key={f.key} type="button" role="radio" aria-checked={filter === f.key} onClick={() => setFilter(f.key)} className="fl-seg-item">
                {f.label}
                <span className="text-xs font-normal text-ink-muted tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <select
          id="campaigns-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar campañas"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {campaigns.length > 7 && (
          <input id="campaigns-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campaña" className={toolbarInput} />
        )}
        <button
          type="button"
          className={`${toolbarButton} sm:ml-auto`}
          onClick={() =>
            downloadCsv("campanas.csv", [
              ["Campaña", "Estado", "Objetivo", `Inversión (${currency})`, "Qué consiguió", "Cantidad", "Costo de cada uno", "Recomendación", "Personas alcanzadas", "Impresiones", "CTR enlace %", "CPC", "CPM", "Frecuencia", "ROAS"],
              ...rows.map((c) => [
                c.name,
                (c.status && STATUS[c.status]?.label) ?? c.status,
                c.objective,
                c.spend.toFixed(2),
                c.outcome.plural,
                c.outcome.count,
                c.outcome.cost?.toFixed(2) ?? null,
                c.verdictLabel,
                c.reach,
                c.impressions,
                c.linkCtr?.toFixed(2) ?? null,
                c.cpc?.toFixed(2) ?? null,
                c.cpm?.toFixed(2) ?? null,
                c.frequency?.toFixed(2) ?? null,
                c.roas?.toFixed(2) ?? null,
              ]),
            ])
          }
        >
          Descargar Excel (CSV)
        </button>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id} c={c} money={money} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
          {campaigns.length === 0
            ? "Ninguna campaña tuvo gasto en estas fechas. Para ver campañas anteriores, cambia las fechas de los anuncios (por ejemplo, Últimos 12 meses)."
            : "Ninguna campaña coincide con este filtro."}
        </p>
      )}
      <Pager page={page} pages={pages} total={rows.length} noun="campañas" onPage={setPage} />
    </div>
  );
}
