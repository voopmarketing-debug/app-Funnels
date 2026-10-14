"use client";

import { useMemo, useState } from "react";
import type { AdCampaign, SocialPost } from "@/lib/metaSocial";
import { moneyFormatter, shortDate, shortDateTime } from "./format";
import { toCsv } from "@/lib/csv";

const NETWORK = {
  facebook: { label: "Facebook", color: "var(--series-fb)" },
  instagram: { label: "Instagram", color: "var(--series-ig)" },
} as const;

const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));


function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  // toCsv neutralises formulas: captions and campaign names come from Meta, not from us.
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SortHeader<K extends string>({
  label,
  k,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  k: K;
  sort: { key: K; dir: 1 | -1 };
  onSort: (k: K) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <th className={`whitespace-nowrap px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}>
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function useSort<K extends string>(initial: K) {
  const [sort, setSort] = useState<{ key: K; dir: 1 | -1 }>({ key: initial, dir: -1 });
  const onSort = (key: K) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
  return { sort, onSort };
}

const PAGE_SIZE = 7;

/** One page of `rows`; the page goes back to the first whenever the filters or the order change. */
function usePaged<T>(rows: T[], resetKey: string) {
  const [state, setState] = useState({ page: 0, key: resetKey });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = state.key === resetKey ? Math.min(state.page, pages - 1) : 0;
  return {
    page,
    pages,
    visible: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    setPage: (n: number) => setState({ page: n, key: resetKey }),
  };
}

function Pager({ page, pages, total, noun, onPage }: { page: number; pages: number; total: number; noun: string; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  // Up to 5 page numbers around the current one.
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const btn = "min-w-9 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={`Páginas de ${noun}`}>
      <p className="text-xs text-ink-muted tabular-nums">
        {first}–{last} de {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={`${btn} text-ink-muted hover:border-accent hover:text-ink`} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Página anterior">
          ‹ Anterior
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${btn} tabular-nums ${n === page ? "border-accent bg-accent/15 text-ink" : "text-ink-muted hover:border-accent hover:text-ink"}`}
          >
            {n + 1}
          </button>
        ))}
        <button type="button" className={`${btn} text-ink-muted hover:border-accent hover:text-ink`} disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
          Siguiente ›
        </button>
      </div>
    </nav>
  );
}

const toolbarInput = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:w-64";
const toolbarButton = "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink";

type PostSort = "publishedAt" | "views" | "interactions";

export function PostsTable({ posts }: { posts: SocialPost[] }) {
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<"all" | SocialPost["network"]>("all");
  const { sort, onSort } = useSort<PostSort>("publishedAt");
  const networks = Array.from(new Set(posts.map((p) => p.network)));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts
      .filter((p) => (network === "all" || p.network === network) && (!q || p.text.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = a[sort.key] ?? -1;
        const bv = b[sort.key] ?? -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [posts, query, network, sort]);
  const { page, pages, visible, setPage } = usePaged(rows, `${query}|${network}|${sort.key}|${sort.dir}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input id="posts-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en las publicaciones" className={toolbarInput} />
        {networks.length > 1 && (
          <select id="posts-network" value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink">
            <option value="all">Todas las redes</option>
            {networks.map((n) => (
              <option key={n} value={n}>
                {NETWORK[n].label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className={`${toolbarButton} sm:ml-auto`}
          onClick={() =>
            downloadCsv("publicaciones.csv", [
              ["Red", "Fecha", "Tipo", "Texto", "Visualizaciones", "Interacciones", "Enlace"],
              ...rows.map((p) => [NETWORK[p.network].label, p.publishedAt, p.type, p.text.replace(/\s+/g, " ").slice(0, 300), p.views, p.interactions, p.permalink]),
            ])
          }
        >
          Descargar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Publicación</th>
              <SortHeader label="Fecha" k="publishedAt" sort={sort} onSort={onSort} align="left" />
              <SortHeader label="Visualizaciones" k="views" sort={sort} onSort={onSort} />
              <SortHeader label="Interacciones" k="interactions" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-surface-2 text-[10px] text-ink-faint">{p.type}</span>
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: NETWORK[p.network].color }} />
                        {NETWORK[p.network].label} · {p.type}
                      </p>
                      <p className="line-clamp-2 max-w-md text-ink">{p.text || <span className="text-ink-faint">Sin texto</span>}</p>
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                          Ver publicación
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{shortDateTime(p.publishedAt)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.views)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(p.interactions)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-ink-muted">
                  {posts.length === 0 ? "No hubo publicaciones en este período." : "Ninguna publicación coincide con la búsqueda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} total={rows.length} noun="publicaciones" onPage={setPage} />
    </div>
  );
}

type CampaignSort =
  | "name"
  | "spend"
  | "results"
  | "costPerResult"
  | "conversations"
  | "costPerConversation"
  | "linkCtr"
  | "cpc"
  | "cpm"
  | "frequency"
  | "roas"
  | "impressions";

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: "Activa", dot: "#0ca30c" },
  PAUSED: { label: "Pausada", dot: "#8a8a86" },
  CAMPAIGN_PAUSED: { label: "Pausada", dot: "#8a8a86" },
  ARCHIVED: { label: "Archivada", dot: "#8a8a86" },
  DELETED: { label: "Eliminada", dot: "#8a8a86" },
  IN_PROCESS: { label: "En revisión", dot: "#fab219" },
  WITH_ISSUES: { label: "Con problemas", dot: "#d03b3b" },
};

const dec = (n: number | null, digits = 2) => (n == null ? "—" : n.toFixed(digits).replace(".", ","));

export function CampaignsTable({ campaigns, currency, objectiveLabels }: { campaigns: AdCampaign[]; currency: string; objectiveLabels: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const { sort, onSort } = useSort<CampaignSort>("spend");
  const money = moneyFormatter(currency);
  const showConversations = campaigns.some((c) => c.conversations);
  const showRoas = campaigns.some((c) => c.purchaseValue);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .map((c) => ({
        ...c,
        linkCtr: c.impressions > 0 && c.linkClicks != null ? (c.linkClicks / c.impressions) * 100 : null,
        cpc: (c.linkClicks ?? c.clicks) > 0 ? c.spend / (c.linkClicks || c.clicks) : null,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
        frequency: c.reach > 0 ? c.impressions / c.reach : null,
        costPerResult: c.results ? c.spend / c.results : null,
        costPerConversation: c.conversations ? c.spend / c.conversations : null,
        roas: c.purchaseValue && c.spend > 0 ? c.purchaseValue / c.spend : null,
      }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (objectiveLabels[c.objective] ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sort.key] ?? -1;
        const bv = b[sort.key] ?? -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [campaigns, query, sort, objectiveLabels]);
  const { page, pages, visible, setPage } = usePaged(rows, `${query}|${sort.key}|${sort.dir}`);

  const cols = 9 + (showConversations ? 2 : 0) + (showRoas ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input id="campaigns-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campaña" className={toolbarInput} />
        <button
          type="button"
          className={`${toolbarButton} sm:ml-auto`}
          onClick={() =>
            downloadCsv("campanas.csv", [
              [
                "Campaña",
                "Estado",
                "Objetivo",
                `Gasto (${currency})`,
                "Resultados",
                "Costo por resultado",
                "Conversaciones",
                "Costo por conversación",
                "Impresiones",
                "Alcance",
                "Frecuencia",
                "Clics al enlace",
                "CTR enlace %",
                "CPC",
                "CPM",
                "Valor de compras",
                "ROAS",
              ],
              ...rows.map((c) => [
                c.name,
                STATUS_LABELS[c.status ?? ""]?.label ?? c.status ?? null,
                objectiveLabels[c.objective] ?? c.objective,
                c.spend.toFixed(2),
                c.results,
                c.costPerResult?.toFixed(2) ?? null,
                c.conversations ?? null,
                c.costPerConversation?.toFixed(2) ?? null,
                c.impressions,
                c.reach,
                c.frequency?.toFixed(2) ?? null,
                c.linkClicks ?? null,
                c.linkCtr?.toFixed(2) ?? null,
                c.cpc?.toFixed(2) ?? null,
                c.cpm?.toFixed(2) ?? null,
                c.purchaseValue?.toFixed(2) ?? null,
                c.roas?.toFixed(2) ?? null,
              ]),
            ])
          }
        >
          Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-surface-2 text-xs text-ink-muted">
            <tr>
              <SortHeader label="Campaña" k="name" sort={sort} onSort={onSort} align="left" />
              <SortHeader label="Gasto" k="spend" sort={sort} onSort={onSort} />
              <SortHeader label="Resultados" k="results" sort={sort} onSort={onSort} />
              <SortHeader label="Costo/resultado" k="costPerResult" sort={sort} onSort={onSort} />
              {showConversations && <SortHeader label="Conversaciones" k="conversations" sort={sort} onSort={onSort} />}
              {showConversations && <SortHeader label="Costo/conversación" k="costPerConversation" sort={sort} onSort={onSort} />}
              <SortHeader label="CTR enlace" k="linkCtr" sort={sort} onSort={onSort} />
              <SortHeader label="CPC" k="cpc" sort={sort} onSort={onSort} />
              <SortHeader label="CPM" k="cpm" sort={sort} onSort={onSort} />
              <SortHeader label="Frecuencia" k="frequency" sort={sort} onSort={onSort} />
              {showRoas && <SortHeader label="ROAS" k="roas" sort={sort} onSort={onSort} />}
              <SortHeader label="Impresiones" k="impressions" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((c) => {
              const status = STATUS_LABELS[c.status ?? ""];
              return (
                <tr key={c.id}>
                  <td className="max-w-xs px-3 py-2.5">
                    <p className="truncate font-medium text-ink" title={c.name}>
                      {c.name}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      {status && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                          {status.label}
                        </span>
                      )}
                      <span>{objectiveLabels[c.objective] ?? "—"}</span>
                      {c.updatedAt && <span className="text-ink-faint">· editada {shortDate(c.updatedAt)}</span>}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.spend)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.results)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.costPerResult)}</td>
                  {showConversations && <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.conversations)}</td>}
                  {showConversations && <td className="px-3 py-2.5 text-right tabular-nums">{money(c.costPerConversation)}</td>}
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.linkCtr == null ? "—" : `${dec(c.linkCtr)}%`}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(c.cpc)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(c.cpm)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{dec(c.frequency, 1)}</td>
                  {showRoas && <td className="px-3 py-2.5 text-right tabular-nums">{c.roas == null ? "—" : `${dec(c.roas, 1)}x`}</td>}
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{fmt(c.impressions)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-3 py-8 text-center text-ink-muted">
                  {campaigns.length === 0
                    ? "Ninguna campaña tuvo gasto en estas fechas. Para ver campañas anteriores, cambia las fechas de los anuncios (por ejemplo, Últimos 12 meses)."
                    : "Ninguna campaña coincide con la búsqueda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} total={rows.length} noun="campañas" onPage={setPage} />
    </div>
  );
}
