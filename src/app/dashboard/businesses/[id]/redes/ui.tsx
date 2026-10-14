import { rangeLength, type DayRange } from "@/lib/socialRanges";

// Pieces shared by the Métricas and Anuncios tabs of Redes sociales.

export type Status = "good" | "warning" | "critical" | "neutral";

export const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));
export const dec = (n: number | null | undefined, digits = 2) => (n == null ? "—" : n.toFixed(digits).replace(".", ","));

/** "los 30 días anteriores": what the arrows compare against. */
export const previousText = (r: DayRange) => {
  const n = rangeLength(r);
  return n === 1 ? "el día anterior" : `los ${n} días anteriores`;
};

/** "▲ 16% vs. los 30 días anteriores", green when it moved the good way. */
export function Delta({ now, before, invert = false, period }: { now: number | null | undefined; before: number | null | undefined; invert?: boolean; period: string }) {
  if (now == null || before == null || before === 0) return null;
  const pct = ((now - before) / before) * 100;
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.5;
  const good = invert ? !up : up;
  return (
    <p className="text-xs text-ink-muted">
      <span className="font-semibold tabular-nums" style={{ color: flat ? "var(--ink-muted)" : good ? "var(--status-good)" : "var(--status-bad)" }}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0).replace(".", ",")}%
      </span>{" "}
      vs. {period}
    </p>
  );
}

export function Section({ title, subtitle, children, aside }: { title: string; subtitle: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="max-w-2xl text-sm text-ink-muted">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** While the ads of other dates load, the rest of the page stays put. */
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-4" aria-busy="true">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="fl-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="fl-card h-56 animate-pulse" />
    </section>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fl-card min-w-0 p-4 md:p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mb-4 mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      {children}
    </div>
  );
}

export function SectionError({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
      No pudimos traer estos datos de Meta: <span className="text-ink">{error}</span>
    </div>
  );
}

