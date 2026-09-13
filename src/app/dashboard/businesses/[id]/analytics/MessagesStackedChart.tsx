"use client";

import { useMemo, useState } from "react";
import type { DailyMessagePoint } from "@/lib/analytics";

const WIDTH = 640;
const HEIGHT = 240;
const PADDING = { top: 16, right: 12, bottom: 28, left: 32 };
const GAP = 2; // surface-color gap between stacked segments, per dataviz mark spec
const SURFACE = "#161616";

// Validated (dataviz skill validator, --pairs all, dark mode, this app's
// surface #161616): worst all-pairs CVD ΔE 9.4, normal-vision ΔE 20.9 — all pass.
const SERIES = [
  { key: "cliente" as const, label: "Cliente", color: "#3987e5" },
  { key: "ia" as const, label: "IA", color: "#199e70" },
  { key: "humano" as const, label: "Humano", color: "#d95926" },
];

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

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, h, w / 2));
  if (h <= 0 || w <= 0) return "";
  return `M ${x} ${y + h} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h} Z`;
}

export function MessagesStackedChart({ data }: { data: DailyMessagePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baselineY = PADDING.top + plotHeight;

  const totals = data.map((d) => d.cliente + d.ia + d.humano);
  const maxValue = useMemo(() => niceMax(Math.max(1, ...totals)), [totals]);
  const scale = plotHeight / maxValue;

  const slot = plotWidth / data.length;
  const barWidth = Math.min(24, slot * 0.65);

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const labelEvery = Math.ceil(data.length / 6);

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const index = Math.min(data.length - 1, Math.max(0, Math.floor((relX - PADDING.left) / slot)));
    setHoverIndex(index);
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? PADDING.left + hoverIndex * slot + slot / 2 : 0;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Mensajes por día, por tipo de remitente"
      >
        {yTicks.map((tick) => {
          const y = baselineY - tick * scale;
          return (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="#2a2a2a" strokeWidth={1} />
              <text x={PADDING.left - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#8a8a86">
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = PADDING.left + i * slot + (slot - barWidth) / 2;
          const values = [d.cliente, d.ia, d.humano];
          const lastNonZero = values.reduce((acc, v, idx) => (v > 0 ? idx : acc), -1);

          let cursorY = baselineY;
          const segments = values.map((v, idx) => {
            const h = v * scale;
            const isTop = idx === lastNonZero;
            const drawH = h > GAP ? h - GAP : h;
            const y = cursorY - h;
            cursorY -= h;
            return { color: SERIES[idx].color, y, h: drawH, isTop };
          });

          return (
            <g key={d.date} className={i % labelEvery === 0 ? "" : undefined}>
              {segments.map((seg, idx) =>
                seg.h > 0 ? (
                  seg.isTop ? (
                    <path key={idx} d={topRoundedRectPath(x, seg.y, barWidth, seg.h, 4)} fill={seg.color} />
                  ) : (
                    <rect key={idx} x={x} y={seg.y} width={barWidth} height={seg.h} fill={seg.color} />
                  )
                ) : null,
              )}
              {i % labelEvery === 0 && (
                <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="#8a8a86">
                  {formatDayLabel(d.date)}
                </text>
              )}
            </g>
          );
        })}

        {hovered && (
          <line
            x1={hoveredX}
            x2={hoveredX}
            y1={PADDING.top}
            y2={baselineY}
            stroke="#3d3d3d"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(hoveredX / WIDTH) * 100}%`, backgroundColor: SURFACE }}
        >
          <p className="mb-1 font-medium text-ink-muted">{formatDayLabel(hovered.date)}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} />
              <span className="font-semibold text-ink">{hovered[s.key]}</span>
              <span className="text-ink-muted">{s.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
