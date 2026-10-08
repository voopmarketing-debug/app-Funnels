import { InfoTip } from "./InfoTip";

// Status colors are a small fixed scale with reserved meaning, never reused
// for chart series identity. They always ship with a dot + a text label,
// never color alone.
const STATUS_STYLES: Record<"good" | "warning" | "critical" | "neutral", { dot: string; label: string; bg: string; fg: string }> = {
  good: { dot: "#0ca30c", label: "Bien", bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)" },
  warning: { dot: "#fab219", label: "Atención", bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)" },
  critical: { dot: "#d03b3b", label: "Mejorar", bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)" },
  neutral: { dot: "#8a8a86", label: "Sin datos", bg: "rgba(138,138,134,0.14)", fg: "var(--ink-muted)" },
};

// Identity color of the card's icon tile — the same family as the agent
// page's connection cards. Decorative only: whether a number is good or bad
// is said by the status pill, never by this color.
export type StatTone = "accent" | "secondary" | "amber" | "blue";

const TONE_STYLES: Record<StatTone, string> = {
  accent: "linear-gradient(135deg, #16a34a, #0f6e35)",
  secondary: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  amber: "linear-gradient(135deg, #f59e0b, #d9620b)",
  blue: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
};

export function StatTile({
  label,
  value,
  sublabel,
  status,
  description,
  hint,
  goal,
  tone = "accent",
  icon,
  children,
}: {
  label: string;
  value: string;
  /** Context next to the number, e.g. "8 en total". */
  sublabel?: string;
  status?: "good" | "warning" | "critical" | "neutral";
  /** Full plain-language explanation, behind the ⓘ. */
  description: string;
  /** One short line always visible under the label. Falls back to nothing. */
  hint?: string;
  /** What "good" looks like, e.g. "Meta: 80% o más". */
  goal?: string;
  tone?: StatTone;
  icon?: React.ReactNode;
  /** Optional mini visualization under the number. */
  children?: React.ReactNode;
}) {
  const statusStyle = status ? STATUS_STYLES[status] : null;

  return (
    <div className="fl-card flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        {icon ? (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-white shadow-sm" style={{ background: TONE_STYLES[tone] }}>
            {icon}
          </span>
        ) : (
          <span />
        )}
        <InfoTip text={description} label={label} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-snug text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-ink-muted">{hint}</p>}

      <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-3">
        {/* Money values ("$12.500.000") get smaller on phones so they fit the 2-column grid. */}
        <p
          className={`font-bold tabular-nums tracking-tight text-ink ${
            value.length > 10 ? "text-xl sm:text-3xl" : value.length > 7 ? "text-2xl sm:text-3xl" : "text-3xl"
          }`}
        >
          {value}
        </p>
        {sublabel && <p className="text-xs text-ink-muted">{sublabel}</p>}
      </div>

      {children && <div className="mt-2">{children}</div>}

      {(statusStyle || goal) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5 text-xs">
          {statusStyle && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold" style={{ background: statusStyle.bg, color: statusStyle.fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
              {statusStyle.label}
            </span>
          )}
          {goal && <span className="text-ink-faint">{goal}</span>}
        </div>
      )}
    </div>
  );
}
