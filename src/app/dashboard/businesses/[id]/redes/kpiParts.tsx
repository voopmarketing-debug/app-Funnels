import type { Level, Tone } from "@/lib/contentKpis";

// Small pieces shared by the creatives (Anuncios) and organic content
// (Métricas) readouts. Colour always comes with a word: a level is never
// told by its dot alone.

export const LEVEL_STYLE: Record<Level, { dot: string; bg: string; fg: string; label: string }> = {
  good: { dot: "#0ca30c", bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)", label: "Bien" },
  ok: { dot: "#fab219", bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)", label: "Aceptable" },
  weak: { dot: "#d03b3b", bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)", label: "Mejorar" },
};

export const TONE_DOT: Record<Tone, string> = { good: "#0ca30c", warn: "#fab219", bad: "#d03b3b" };

export function LevelPill({ level }: { level: Level }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

/** "Qué hacer": one sentence per action, each with a coloured dot. */
export function ToneList({ items, className = "" }: { items: { tone: Tone; text: string }[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((h, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
          <span className="mt-2 h-2 w-2 flex-none rounded-full" style={{ background: TONE_DOT[h.tone] }} aria-hidden="true" />
          <span>{h.text}</span>
        </li>
      ))}
    </ul>
  );
}

export type BarRow = {
  key: string;
  label: string;
  /** 0-100 */
  pct: number;
  value: string;
  note?: string;
  badge?: { text: string; tone: Tone };
};

/** Horizontal bars with the number written next to each (never the bar alone). */
export function BarList({ rows, color = "var(--series-fb)" }: { rows: BarRow[]; color?: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
            <span className="flex items-center gap-2 font-medium text-ink">
              {r.label}
              {r.badge && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${TONE_DOT[r.badge.tone]}22`, color: "var(--ink)" }}>
                  {r.badge.text}
                </span>
              )}
            </span>
            <span className="tabular-nums text-ink">
              {r.value}
              {r.note && <span className="ml-2 text-xs text-ink-muted">{r.note}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, r.pct))}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A note about what Meta does or doesn't report, in plain words. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-ink-muted">{children}</p>;
}
