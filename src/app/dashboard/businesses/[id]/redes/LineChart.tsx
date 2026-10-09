"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Daily line chart for the Redes sociales page: one or more series on one
// shared axis (Facebook in --series-fb, Instagram in --series-ig, validated
// for both themes), a crosshair tooltip and, for 2+ series, a legend.

export type ChartSeries = { key: string; label: string; color: string; values: Record<string, number | null> };

const HEIGHT = 230;
const PADDING = { top: 16, right: 14, bottom: 28, left: 48 };

function niceScale(min: number, max: number): { lo: number; hi: number } {
  const span = Math.max(1, max - min);
  const magnitude = 10 ** Math.floor(Math.log10(span));
  const step = magnitude / 2;
  const lo = min >= 0 ? 0 : Math.floor(min / step) * step;
  const hi = Math.max(lo + step, Math.ceil(max / step) * step);
  return { lo, hi };
}

const dayLabel = (day: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")} M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)} mil`;
  return Math.round(n).toLocaleString("es-CO");
}

function useChartWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function LineChart({
  days,
  series,
  format = (n) => n.toLocaleString("es-CO"),
  emptyText = "Sin datos en este período",
  label,
}: {
  days: string[];
  series: ChartSeries[];
  format?: (n: number) => string;
  emptyText?: string;
  label: string;
}) {
  const { ref, width: WIDTH } = useChartWidth(640);
  const [hover, setHover] = useState<number | null>(null);
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;

  const values = series.flatMap((s) => days.map((d) => s.values[d]).filter((v): v is number => v != null));
  const isEmpty = values.length === 0 || values.every((v) => v === 0);
  const { lo, hi } = useMemo(() => niceScale(Math.min(0, ...values), Math.max(0, ...values)), [values]);

  const x = (i: number) => PADDING.left + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
  const y = (v: number) => PADDING.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    days.forEach((day, i) => {
      const v = s.values[day];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return { ...s, d };
  });

  const ticks = lo < 0 ? [lo, 0, hi] : [lo, lo + (hi - lo) / 2, hi];
  const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(WIDTH / 90)));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((relX - PADDING.left) / plotW) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  }

  const hoverDay = hover != null ? days[hover] : null;

  return (
    <div className="space-y-3">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={label}
        >
          {ticks.map((t) => (
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
              <text x={PADDING.left - 8} y={y(t) + 3} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                {compact(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                {dayLabel(d)}
              </text>
            ) : null,
          )}
          {!isEmpty &&
            paths.map((p) => <path key={p.key} d={p.d} fill="none" style={{ stroke: p.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {hoverDay && !isEmpty && (
            <>
              <line x1={x(hover!)} x2={x(hover!)} y1={PADDING.top} y2={PADDING.top + plotH} style={{ stroke: "var(--border-strong)" }} strokeWidth={1} />
              {series.map((s) => {
                const v = s.values[hoverDay];
                return v == null ? null : (
                  <circle key={s.key} cx={x(hover!)} cy={y(v)} r={4.5} style={{ fill: s.color, stroke: "var(--surface)" }} strokeWidth={2} />
                );
              })}
            </>
          )}
        </svg>
        {isEmpty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-muted">{emptyText}</p>}
        {hoverDay && !isEmpty && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${Math.min(85, Math.max(15, (x(hover!) / WIDTH) * 100))}%` }}
          >
            <p className="mb-1 text-ink-muted">{dayLabel(hoverDay)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums text-ink">{s.values[hoverDay] == null ? "—" : format(s.values[hoverDay]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
