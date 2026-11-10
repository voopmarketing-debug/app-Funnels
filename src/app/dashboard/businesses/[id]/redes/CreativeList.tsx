"use client";

import { useMemo, useState } from "react";
import type { CreativeAction, CreativeVerdict, Level, RetentionStep } from "@/lib/contentKpis";
import type { AdRankings, RankingLevel } from "@/lib/adCreatives";
import { moneyFormatter } from "./format";
import { LEVEL_STYLE, LevelPill, ToneList } from "./kpiParts";
import { Pager, usePaged } from "./tables";

// Every ad as a card: what it is, how it scored and the one thing to do about
// it. The funnel (stops → stays → clicks → writes) sits in the middle, where a
// media buyer reads it.

export type CreativeCard = {
  id: string;
  name: string;
  campaignName: string;
  status: string | null;
  thumbnail: string | null;
  isVideo: boolean;
  spend: number;
  share: number;
  verdict: CreativeVerdict;
  verdictLabel: string;
  score: number | null;
  scoreLabel: string | null;
  hook: number | null;
  hookLevel: Level | null;
  hold: number | null;
  holdLevel: Level | null;
  ctr: number | null;
  ctrLevel: Level | null;
  cost: number | null;
  costLevel: Level | null;
  conversations: number;
  frequency: number | null;
  frequencyLevel: Level | null;
  avgWatchSeconds: number | null;
  retention: RetentionStep[];
  rankings: AdRankings | null;
  actions: CreativeAction[];
};

const VERDICT_STYLE: Record<CreativeVerdict, { bg: string; fg: string; dot: string }> = {
  escalar: { bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)", dot: "#0ca30c" },
  mantener: { bg: "rgba(12,163,12,0.08)", fg: "var(--status-good)", dot: "#0ca30c" },
  optimizar: { bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)", dot: "#fab219" },
  reemplazar: { bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)", dot: "#d03b3b" },
  poco_dato: { bg: "rgba(138,138,134,0.14)", fg: "var(--ink-muted)", dot: "#8a8a86" },
};
const VERDICT_ORDER: CreativeVerdict[] = ["reemplazar", "optimizar", "escalar", "mantener", "poco_dato"];

const RANKING_LABELS: Record<RankingLevel, { text: string; level: Level }> = {
  above: { text: "Arriba del promedio", level: "good" },
  average: { text: "En el promedio", level: "ok" },
  below: { text: "Debajo del promedio", level: "weak" },
};

const STATUS: Record<string, { label: string; on: boolean }> = {
  ACTIVE: { label: "Encendido", on: true },
  PAUSED: { label: "Apagado", on: false },
  CAMPAIGN_PAUSED: { label: "Apagado", on: false },
  ADSET_PAUSED: { label: "Apagado", on: false },
  ARCHIVED: { label: "Archivado", on: false },
  DELETED: { label: "Eliminado", on: false },
  IN_PROCESS: { label: "En revisión", on: false },
  WITH_ISSUES: { label: "Con problemas", on: false },
};

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "scale", label: "Para escalar" },
  { key: "fix", label: "Para mejorar" },
  { key: "replace", label: "Para reemplazar" },
  { key: "video", label: "Videos" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "attention", label: "Primero los que necesitan atención" },
  { key: "spend", label: "Más inversión primero" },
  { key: "score", label: "Mejor nota primero" },
  { key: "hook", label: "Mejor gancho primero" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

const matches = (c: CreativeCard, f: Filter) =>
  f === "all" || (f === "scale" && c.verdict === "escalar") || (f === "fix" && c.verdict === "optimizar") || (f === "replace" && c.verdict === "reemplazar") || (f === "video" && c.isVideo);

const dec = (n: number | null, digits = 1) => (n == null ? "—" : n.toFixed(digits).replace(".", ","));
const pctText = (n: number | null) => (n == null ? "—" : `${n < 10 ? dec(n, 1) : Math.round(n)}%`);

function Kpi({ label, value, hint, level }: { label: string; value: string; hint: string; level: Level | null }) {
  return (
    <div className="min-w-0 space-y-0.5 rounded-xl bg-surface-2/60 p-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] leading-snug text-ink-muted">{hint}</p>
      {level && <LevelPill level={level} />}
    </div>
  );
}

function Retention({ steps, avg }: { steps: RetentionStep[]; avg: number | null }) {
  if (steps.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-muted">
        De quienes se detuvieron a verlo, ¿cuántos llegaron a…?
        {avg != null && <span className="ml-2 font-normal">Lo ven {dec(avg)} segundos en promedio.</span>}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-4" aria-label="Retención del video">
        {steps.map((s) => (
          <li key={s.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-ink-muted">{s.label} del video</span>
              <span className="font-semibold tabular-nums text-ink">{pctText(s.pct)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, s.pct)}%`, background: "var(--series-ig)" }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ c, money }: { c: CreativeCard; money: (n: number | null | undefined) => string }) {
  const verdict = VERDICT_STYLE[c.verdict];
  const status = c.status ? STATUS[c.status] : null;
  const ranks = c.rankings
    ? ([
        ["Calidad según Meta", c.rankings.quality],
        ["Interacción según Meta", c.rankings.engagement],
        ["Conversión según Meta", c.rankings.conversion],
      ] as const)
    : [];

  return (
    <article className="fl-card min-w-0 space-y-4 p-4 md:p-5">
      <div className="flex min-w-0 gap-3">
        {c.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnail} alt="" className="h-14 w-14 flex-none rounded-xl object-cover sm:h-16 sm:w-16 md:h-20 md:w-20" loading="lazy" />
        ) : (
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-surface-2 text-[11px] text-ink-faint sm:h-16 sm:w-16 md:h-20 md:w-20">{c.isVideo ? "Video" : "Anuncio"}</span>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: verdict.bg, color: verdict.fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: verdict.dot }} />
              {c.verdictLabel}
            </span>
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.on ? "#0ca30c" : "#8a8a86" }} />
                {status.label}
              </span>
            )}
            <span className="rounded-full border border-border px-2.5 py-1 text-ink-muted">{c.isVideo ? "Video" : "Imagen"}</span>
          </div>
          <h4 className="line-clamp-3 break-words font-semibold leading-snug text-ink [overflow-wrap:anywhere]" title={c.name}>
            {c.name}
          </h4>
          {c.campaignName && <p className="line-clamp-1 text-xs text-ink-muted">Campaña: {c.campaignName}</p>}
        </div>
        <div className="flex-none text-right">
          {c.score != null ? (
            <>
              <p className="text-2xl font-bold tabular-nums leading-none text-ink">
                {c.score}
                <span className="text-xs font-semibold text-ink-muted">/100</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-ink-muted">{c.scoreLabel}</p>
            </>
          ) : (
            <p className="text-xs text-ink-faint">Sin nota</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Invertiste" value={money(c.spend)} hint={`${Math.round(c.share * 100)}% de lo invertido`} level={null} />
        {c.isVideo && <Kpi label="Gancho" value={pctText(c.hook)} hint="De cada 100 que lo vieron, cuántos se detuvieron 3 s" level={c.hookLevel} />}
        {c.isVideo && <Kpi label="Retención" value={pctText(c.hold)} hint="De los que se detuvieron, cuántos lo vieron casi completo" level={c.holdLevel} />}
        <Kpi label="Clics al enlace" value={c.ctr == null ? "—" : `${dec(c.ctr, 2)}%`} hint="De cada 100 que lo vieron, cuántos hicieron clic" level={c.ctrLevel} />
        <Kpi
          label="Costo por conversación"
          value={c.cost == null ? "—" : money(c.cost)}
          hint={c.conversations ? `${c.conversations} ${c.conversations === 1 ? "conversación" : "conversaciones"}` : "Ninguna conversación"}
          level={c.costLevel}
        />
        <Kpi label="Frecuencia" value={dec(c.frequency)} hint="Veces que cada persona lo vio" level={c.frequencyLevel} />
      </div>

      <Retention steps={c.retention} avg={c.avgWatchSeconds} />

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Qué hacer</p>
        <ToneList items={c.actions} />
      </div>

      {ranks.some(([, v]) => v) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          {ranks.map(([label, v]) =>
            v ? (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-ink">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_STYLE[RANKING_LABELS[v].level].dot }} />
                {label}: {RANKING_LABELS[v].text}
              </span>
            ) : null,
          )}
        </div>
      )}
    </article>
  );
}

export function CreativeList({ creatives, currency }: { creatives: CreativeCard[]; currency: string }) {
  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("attention");

  const rows = useMemo(() => {
    const list = creatives.filter((c) => matches(c, filter));
    const by: Record<Sort, (a: CreativeCard, b: CreativeCard) => number> = {
      attention: (a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || b.spend - a.spend,
      spend: (a, b) => b.spend - a.spend,
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      hook: (a, b) => (b.hook ?? -1) - (a.hook ?? -1),
    };
    return [...list].sort(by[sort]);
  }, [creatives, filter, sort]);
  const { page, pages, visible, setPage } = usePaged(rows, `${filter}|${sort}`, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar anuncios">
          {FILTERS.map((f) => {
            const count = creatives.filter((c) => matches(c, f.key)).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === f.key ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-accent hover:text-ink"}`}
              >
                {f.label} <span className="tabular-nums text-ink-faint">{count}</span>
              </button>
            );
          })}
        </div>
        <select
          id="creatives-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar anuncios"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink sm:ml-auto"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="fl-card p-6 text-center text-sm text-ink-muted">Ningún anuncio coincide con este filtro.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id} c={c} money={money} />
          ))}
        </div>
      )}
      <Pager page={page} pages={pages} total={rows.length} noun="anuncios" onPage={setPage} size={5} />
    </div>
  );
}
