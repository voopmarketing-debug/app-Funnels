"use client";

import { useState } from "react";
import type { StagePoint } from "@/lib/analytics";

const WIDTH = 640;
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 20;
const PADDING = { top: 8, right: 56, bottom: 8, left: 12 };

// Ordinal encoding, not categorical: these bars are the SAME hue (brand
// accent) at increasing lightness steps by pipeline position — the color
// tells the reader "further along the funnel", it does not identify separate
// series. That's why there's no swatch legend here (see dataviz skill:
// ordinal ramps carry order in one hue; a legend box is a categorical thing).
const ACCENT_HUE = "182, 255, 43"; // #b5ff2b as an rgb triplet, for opacity steps

function rightRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, h / 2, w));
  if (w <= 0 || h <= 0) return `M ${x} ${y} L ${x} ${y + h} L ${x} ${y}`;
  return `M ${x} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} L ${x} ${y + h} Z`;
}

export function StageDistributionChart({ stages }: { stages: StagePoint[] }) {
  const [hoverId, setHoverId] = useState<number | null>(null);

  const height = PADDING.top + PADDING.bottom + stages.length * ROW_HEIGHT;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const n = Math.max(1, stages.length - 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Conversaciones por etapa del pipeline">
        {stages.map((stage, i) => {
          const y = PADDING.top + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
          const w = (stage.count / maxCount) * plotWidth;
          const opacity = 0.45 + (i / n) * 0.55;
          const isHovered = hoverId === i;

          return (
            <g
              key={stage.name + i}
              onPointerEnter={() => setHoverId(i)}
              onPointerLeave={() => setHoverId((cur) => (cur === i ? null : cur))}
              style={{ cursor: "default" }}
            >
              <rect x={PADDING.left} y={y - 2} width={plotWidth + PADDING.right} height={BAR_HEIGHT + 4} fill="transparent" />
              <text x={PADDING.left} y={y - 6} fontSize={11} style={{ fill: "var(--ink-muted)" }}>
                {stage.name}
              </text>
              <path
                d={rightRoundedRectPath(PADDING.left, y, Math.max(2, w), BAR_HEIGHT, 4)}
                fill={`rgba(${ACCENT_HUE}, ${opacity})`}
                style={{ stroke: isHovered ? "var(--ink)" : "none" }}
                strokeWidth={isHovered ? 1 : 0}
              />
              <text x={PADDING.left + Math.max(2, w) + 8} y={y + BAR_HEIGHT / 2 + 4} fontSize={12} fontWeight={600} style={{ fill: "var(--ink)" }}>
                {stage.count}
              </text>
            </g>
          );
        })}
      </svg>

      {hoverId !== null && (
        <div
          className="pointer-events-none absolute right-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ top: hoverId * ROW_HEIGHT }}
        >
          <p className="font-semibold text-ink">{stages[hoverId].count} conversaciones</p>
          <p className="text-ink-muted">{stages[hoverId].name}</p>
        </div>
      )}
    </div>
  );
}
