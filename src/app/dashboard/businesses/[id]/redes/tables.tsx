"use client";

import { useMemo, useState } from "react";
import type { SocialPost } from "@/lib/metaSocial";
import { shortDateTime } from "./format";
import { toCsv } from "@/lib/csv";

const NETWORK = {
  facebook: { label: "Facebook", color: "var(--series-fb)" },
  instagram: { label: "Instagram", color: "var(--series-ig)" },
} as const;

const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));


export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
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
  title,
}: {
  label: string;
  k: K;
  sort: { key: K; dir: 1 | -1 };
  onSort: (k: K) => void;
  align?: "left" | "right";
  title?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={`whitespace-nowrap px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} title={title} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}>
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
export function usePaged<T>(rows: T[], resetKey: string, size = PAGE_SIZE) {
  const [state, setState] = useState({ page: 0, key: resetKey });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = state.key === resetKey ? Math.min(state.page, pages - 1) : 0;
  return {
    page,
    pages,
    visible: rows.slice(page * size, (page + 1) * size),
    size,
    setPage: (n: number) => setState({ page: n, key: resetKey }),
  };
}

export function Pager({
  page,
  pages,
  total,
  noun,
  onPage,
  size = PAGE_SIZE,
}: {
  page: number;
  pages: number;
  total: number;
  noun: string;
  onPage: (n: number) => void;
  size?: number;
}) {
  if (pages <= 1) return null;
  const first = page * size + 1;
  const last = Math.min(total, (page + 1) * size);
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

export const toolbarInput = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:w-64";
export const toolbarButton = "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink";

type PostSort = "publishedAt" | "views" | "reach" | "interactions" | "rate" | "likes" | "comments" | "saves" | "shares" | "watchSeconds";

/** Interactions per 100 views, the same rate the "Tasa de interacción" card shows. */
const rateOf = (p: SocialPost) => (p.views ? (p.interactions / p.views) * 100 : null);

const valueOf = (p: SocialPost, k: PostSort): number | string | null =>
  k === "publishedAt" ? p.publishedAt : k === "rate" ? rateOf(p) : (p[k] ?? null);

// Each metric with what it means, shown as a tooltip on its header. Posts made
// before a metric was collected, or kinds of post Meta doesn't report it for
// (watch time on a photo), show a dash.
const COLUMNS: { key: Exclude<PostSort, "publishedAt">; label: string; hint: string; show: (p: SocialPost) => string; strong?: boolean }[] = [
  { key: "views", label: "Visualizaciones", hint: "Veces que se vio la publicación", show: (p) => fmt(p.views) },
  { key: "reach", label: "Alcance", hint: "Personas distintas que la vieron (solo videos y reels)", show: (p) => fmt(p.reach) },
  { key: "interactions", label: "Interacciones", hint: "Me gusta, comentarios, guardados y compartidos juntos", show: (p) => fmt(p.interactions), strong: true },
  { key: "rate", label: "Tasa de interacción", hint: "De cada 100 que la vieron, cuántos interactuaron. 3% o más es buena señal", show: (p) => (rateOf(p) == null ? "—" : `${(rateOf(p) as number).toFixed(1).replace(".", ",")}%`), strong: true },
  { key: "likes", label: "Me gusta", hint: "Reacciones a la publicación", show: (p) => fmt(p.likes) },
  { key: "comments", label: "Comentarios", hint: "Comentarios que recibió", show: (p) => fmt(p.comments) },
  { key: "saves", label: "Guardados", hint: "Personas que la guardaron para volver: la señal de que les sirve (Instagram)", show: (p) => fmt(p.saves) },
  { key: "shares", label: "Compartidos", hint: "Veces que la enviaron o compartieron: lo que te trae gente nueva", show: (p) => fmt(p.shares) },
  { key: "watchSeconds", label: "Tiempo visto", hint: "Segundos que se ve en promedio un video o reel", show: (p) => (p.watchSeconds == null ? "—" : `${p.watchSeconds.toFixed(1).replace(".", ",")} s`) },
];

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
        // A post without the metric goes last whichever way it's sorted.
        const av = valueOf(a, sort.key);
        const bv = valueOf(b, sort.key);
        if (av == null || bv == null) return av == null && bv == null ? 0 : av == null ? 1 : -1;
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
              ["Red", "Fecha", "Tipo", "Texto", ...COLUMNS.map((c) => c.label), "Enlace"],
              ...rows.map((p) => [NETWORK[p.network].label, p.publishedAt, p.type, p.text.replace(/\s+/g, " ").slice(0, 300), ...COLUMNS.map((c) => c.show(p)), p.permalink]),
            ])
          }
        >
          Descargar CSV
        </button>
      </div>

      <p className="text-xs text-ink-muted">Desliza la tabla hacia un lado para ver todas las métricas. Toca el título de una columna para ordenar; deja el cursor encima para ver qué significa.</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-surface-2 text-xs text-ink-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left font-semibold">Publicación</th>
              <SortHeader label="Fecha" k="publishedAt" sort={sort} onSort={onSort} align="left" />
              {COLUMNS.map((c) => (
                <SortHeader key={c.key} label={c.label} k={c.key} sort={sort} onSort={onSort} title={c.hint} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="sticky left-0 z-10 bg-surface px-3 py-2.5">
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
                      <p className="line-clamp-2 w-64 max-w-full text-ink">{p.text || <span className="text-ink-faint">Sin texto</span>}</p>
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                          Ver publicación
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{shortDateTime(p.publishedAt)}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${c.strong ? "font-semibold" : ""}`}>
                    {c.show(p)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-3 py-8 text-center text-ink-muted">
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
