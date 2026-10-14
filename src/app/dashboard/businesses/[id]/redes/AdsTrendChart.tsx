"use client";

import { useMemo, useState } from "react";
import type { AdTotals } from "@/lib/metaSocial";
import { bucketDays, bucketLongLabel, bucketShortLabel, UNIT_WORDS } from "@/lib/dayBuckets";
import { compact, useChartWidth } from "./LineChart";
import { moneyFormatter } from "./format";

// "When did I invest and what came back": bars per day, week or month (by
// the range's length) instead of a spiky daily line, with one sentence that
// says what the chart shows.

type Metric = "spend" | "conversations" | "linkClicks";

const METRICS: { key: Metric; label: string; noun: string }[] = [
  { key: "spend", label: "Inversión", noun: "inversión" },
  { key: "conversations", label: "Conversaciones", noun: "conversaciones" },
  { key: "linkClicks", label: "Clics", noun: "clics" },
];

const HEIGHT = 220;
const PADDING = { top: 22, right: 8, bottom: 28, left: 66 };

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = magnitude / 2;
  return Math.ceil(max / step) * step;
}

/** Bar with only its top corners rounded, sitting on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function AdsTrendChart({ days, daily, currency, hasConversations }: { days: string[]; daily: Record<string, AdTotals>; currency: string; hasConversations: boolean }) {
  const metrics = METRICS.filter((m) => m.key !== "conversations" || hasConversations);
  const [metric, setMetric] = useState<Metric>("spend");
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: WIDTH } = useChartWidth(640);
  const money = moneyFormatter(currency);
  const format = (n: number) => (metric === "spend" ? money(n) : Math.round(n).toLocaleString("es-CO"));

  const buckets = useMemo(() => bucketDays(days), [days]);
  const values = useMemo(() => buckets.map((b) => b.days.reduce((a, d) => a + (daily[d]?.[metric] ?? 0), 0)), [buckets, daily, metric]);
  const unit = buckets[0]?.unit ?? "day";
  const words = UNIT_WORDS[unit];
  const max = Math.max(0, ...values);
  const top = niceMax(max);
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const band = plotW / Math.max(1, buckets.length);
  const barW = Math.max(2, Math.min(44, band * 0.68));
  const y = (v: number) => PADDING.top + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 54)));
  const peak = values.indexOf(max);
  const active = values.filter((v) => v > 0).length;
  const noun = METRICS.find((m) => m.key === metric)!.noun;

  const summary =
    max <= 0
      ? `No hubo ${noun} en estas fechas.`
      : `${metric === "spend" ? "Invertiste" : `Tuviste ${noun}`} en ${active} de ${buckets.length} ${buckets.length === 1 ? words.singular : words.plural}. ${
          buckets.length > 1 ? `${words.article} con más ${noun} fue ${bucketLongLabel(buckets[peak])}: ${format(max)}.` : ""
        }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Qué ver en la gráfica" className="fl-seg">
          {metrics.map((m) => (
            <button key={m.key} type="button" role="radio" aria-checked={m.key === metric} onClick={() => setMetric(m.key)} className="fl-seg-item">
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">Cada barra es {unit === "day" ? "un día" : unit === "week" ? "una semana" : "un mes"}</p>
      </div>
      <p className="text-sm text-ink">{summary}</p>
      <div ref={ref} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${noun} por ${words.singular}`} onPointerLeave={() => setHover(null)}>
          {[0, top / 2, top].map((t) => (
            <g key={t}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y(t)}
                y2={y(t)}
                style={{ stroke: "var(--border)" }}
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 4"}
              />
              <text x={PADDING.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                {metric === "spend" && t > 0 ? `$ ${compact(t)}` : compact(t)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const v = values[i];
            const cx = PADDING.left + band * i + band / 2;
            const h = v > 0 ? Math.max(2, PADDING.top + plotH - y(v)) : 0;
            return (
              <g key={b.key}>
                {h > 0 && (
                  <path
                    d={barPath(cx - barW / 2, PADDING.top + plotH - h, barW, h)}
                    style={{ fill: "var(--series-fb)", opacity: hover == null || hover === i ? 1 : 0.45 }}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                    {bucketShortLabel(b)}
                  </text>
                )}
                {/* The whole column is the hover target, not just the bar. */}
                <rect
                  x={PADDING.left + band * i}
                  y={PADDING.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
          {peak >= 0 && max > 0 && hover == null && buckets.length > 1 && (
            <text x={PADDING.left + band * peak + band / 2} y={y(max) - 6} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: "var(--ink)" }}>
              {metric === "spend" ? `$ ${compact(max)}` : compact(max)}
            </text>
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${Math.min(85, Math.max(15, ((PADDING.left + band * hover + band / 2) / WIDTH) * 100))}%` }}
          >
            <p className="mb-0.5 text-ink-muted">{bucketLongLabel(buckets[hover])}</p>
            <p className="font-semibold tabular-nums text-ink">{values[hover] > 0 ? format(values[hover]) : `Sin ${noun}`}</p>
          </div>
        )}
      </div>
    </div>
  );
}
