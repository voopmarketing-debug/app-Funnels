"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DailyPoint } from "@/lib/analytics";

const HEIGHT = 220;
const PADDING = { top: 16, right: 12, bottom: 28, left: 32 };
// Theme accent (lime on dark, deep green on light) so the line reads on both.
const LINE_COLOR = "var(--accent)";

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** Draw the chart at its real pixel width so axis text stays a readable size on phones. */
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

export function ConversationsTrendChart({ data }: { data: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { ref: boxRef, width: WIDTH } = useChartWidth(640);
  const gradientId = useId();
  const isEmpty = data.every((d) => d.value === 0);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = useMemo(() => niceMax(Math.max(1, ...data.map((d) => d.value))), [data]);

  const points = data.map((d, i) => ({
    x: PADDING.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth),
    y: PADDING.top + plotHeight - (d.value / maxValue) * plotHeight,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${PADDING.top + plotHeight} L ${points[0].x.toFixed(1)} ${PADDING.top + plotHeight} Z`;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(WIDTH / 90)));

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIndex(closest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div ref={boxRef} className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Conversaciones nuevas por día"
      >
        {yTicks.map((tick) => {
          const y = PADDING.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} style={{ stroke: "var(--border)" }} strokeWidth={1} strokeDasharray={tick === 0 ? undefined : "3 4"} />
              <text x={PADDING.left - 8} y={y + 3} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.date} x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize={11} style={{ fill: "var(--ink-muted)" }}>
              {formatDayLabel(p.date)}
            </text>
          ) : null,
        )}

        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: LINE_COLOR, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: LINE_COLOR, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" style={{ stroke: LINE_COLOR }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 16 &&
          points.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r={3} style={{ fill: "var(--surface)", stroke: LINE_COLOR }} strokeWidth={2} />)}

        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              style={{ stroke: "var(--border-strong)" }}
              strokeWidth={1}
            />
            <circle cx={hovered.x} cy={hovered.y} r={5} style={{ fill: LINE_COLOR, stroke: "var(--surface)" }} strokeWidth={2} />
          </>
        )}
      </svg>

      {isEmpty && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
          Sin clientes nuevos en este período
        </p>
      )}
      {hovered && !isEmpty && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <p className="font-semibold text-ink">{hovered.value} conversaciones</p>
          <p className="text-ink-muted">{formatDayLabel(hovered.date)}</p>
        </div>
      )}
    </div>
  );
}
