import type { StagePoint } from "@/lib/analytics";

// Ordinal encoding, not categorical: one hue (the theme accent) getting
// stronger the further along the funnel the stage is — so no legend.
// Plain HTML bars (not SVG) so the labels stay crisp and readable at any
// card width.
export function StageDistributionChart({ stages }: { stages: StagePoint[] }) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const n = Math.max(1, stages.length - 1);

  return (
    <ul className="space-y-3" aria-label="Clientes por etapa del embudo">
      {stages.map((stage, i) => {
        const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
        return (
          <li key={stage.name + i} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink">{stage.name}</span>
              <span className="flex-none tabular-nums">
                <span className="font-semibold text-ink">{stage.count.toLocaleString("es-CO")}</span>
                <span className="ml-1.5 text-xs text-ink-muted">{pct}%</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${stage.count > 0 ? Math.max(2, (stage.count / maxCount) * 100) : 0}%`,
                  background: `rgba(var(--glow-accent), ${0.45 + (i / n) * 0.55})`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
