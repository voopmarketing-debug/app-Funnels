"use client";

import { useMemo, useState } from "react";
import type { AdCampaign, SocialPost } from "@/lib/metaSocial";
import { moneyFormatter, shortDate, shortDateTime } from "./format";

const NETWORK = {
  facebook: { label: "Facebook", color: "var(--series-fb)" },
  instagram: { label: "Instagram", color: "var(--series-ig)" },
} as const;

const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));


function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens the accents correctly.
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
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
            {rows.map((p) => (
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
    </div>
  );
}

type CampaignSort = "name" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm" | "results" | "costPerResult" | "updatedAt";

export function CampaignsTable({ campaigns, currency, objectiveLabels }: { campaigns: AdCampaign[]; currency: string; objectiveLabels: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const { sort, onSort } = useSort<CampaignSort>("spend");
  const money = moneyFormatter(currency);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
        cpc: c.clicks > 0 ? c.spend / c.clicks : null,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
        costPerResult: c.results ? c.spend / c.results : null,
      }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (objectiveLabels[c.objective] ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sort.key] ?? -1;
        const bv = b[sort.key] ?? -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [campaigns, query, sort, objectiveLabels]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input id="campaigns-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar campaña" className={toolbarInput} />
        <button
          type="button"
          className={`${toolbarButton} sm:ml-auto`}
          onClick={() =>
            downloadCsv("campanas.csv", [
              ["Campaña", "Objetivo", `Gasto (${currency})`, "Impresiones", "Alcance", "Clics", "CTR %", "CPC", "CPM", "Resultados", "Costo por resultado", "Última actualización"],
              ...rows.map((c) => [
                c.name,
                objectiveLabels[c.objective] ?? c.objective,
                c.spend.toFixed(2),
                c.impressions,
                c.reach,
                c.clicks,
                c.ctr?.toFixed(2) ?? null,
                c.cpc?.toFixed(2) ?? null,
                c.cpm?.toFixed(2) ?? null,
                c.results,
                c.costPerResult?.toFixed(2) ?? null,
                c.updatedAt,
              ]),
            ])
          }
        >
          Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-2 text-xs text-ink-muted">
            <tr>
              <SortHeader label="Campaña" k="name" sort={sort} onSort={onSort} align="left" />
              <SortHeader label="Gasto" k="spend" sort={sort} onSort={onSort} />
              <SortHeader label="Impresiones" k="impressions" sort={sort} onSort={onSort} />
              <SortHeader label="Clics" k="clicks" sort={sort} onSort={onSort} />
              <SortHeader label="CTR" k="ctr" sort={sort} onSort={onSort} />
              <SortHeader label="CPC" k="cpc" sort={sort} onSort={onSort} />
              <SortHeader label="CPM" k="cpm" sort={sort} onSort={onSort} />
              <SortHeader label="Resultados" k="results" sort={sort} onSort={onSort} />
              <SortHeader label="Costo/resultado" k="costPerResult" sort={sort} onSort={onSort} />
              <SortHeader label="Actualizada" k="updatedAt" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="max-w-xs px-3 py-2.5">
                  <p className="truncate font-medium text-ink" title={c.name}>
                    {c.name}
                  </p>
                  <p className="text-xs text-ink-muted">{objectiveLabels[c.objective] ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.spend)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.impressions)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.clicks)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{c.ctr == null ? "—" : `${c.ctr.toFixed(2).replace(".", ",")}%`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(c.cpc)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(c.cpm)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.results)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(c.costPerResult)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-muted">{c.updatedAt ? shortDate(c.updatedAt) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-ink-muted">
                  {campaigns.length === 0 ? "Ninguna campaña tuvo gasto en este período." : "Ninguna campaña coincide con la búsqueda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
