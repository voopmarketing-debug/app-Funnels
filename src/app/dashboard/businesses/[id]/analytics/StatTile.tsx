// Status colors are a small fixed scale with reserved meaning, never reused
// for chart series identity — see the dataviz skill's color-formula. They
// always ship with an icon-like dot + a text label, never color alone.
const STATUS_STYLES: Record<"good" | "warning" | "critical" | "neutral", { dot: string; label: string }> = {
  good: { dot: "#0ca30c", label: "Bien" },
  warning: { dot: "#fab219", label: "Atención" },
  critical: { dot: "#d03b3b", label: "Crítico" },
  neutral: { dot: "#8a8a86", label: "Sin datos" },
};

// Purely decorative per-card tint — cycles through hues already used
// elsewhere in the brand (accent lime, accent-secondary purple, amber,
// blue), kept separate from the STATUS_STYLES dot/label above so color
// alone never has to carry meaning: which tone a card gets says nothing
// about whether that metric is good or bad, only the dot+label does.
export type StatTone = "accent" | "secondary" | "amber" | "blue";

const TONE_STYLES: Record<StatTone, { glowVar: string; solid: string }> = {
  accent: { glowVar: "--glow-accent", solid: "var(--accent)" },
  secondary: { glowVar: "--glow-secondary", solid: "var(--accent-secondary)" },
  amber: { glowVar: "--glow-amber", solid: "#fab219" },
  blue: { glowVar: "--glow-blue", solid: "#3987e5" },
};

export function StatTile({
  label,
  value,
  sublabel,
  status,
  description,
  tone = "accent",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  status?: "good" | "warning" | "critical" | "neutral";
  /** Fixed, plain-language explanation of what this number measures — shown
   * every time, not just contextually, so a non-technical business owner
   * always knows what they're looking at without having to ask. */
  description: string;
  /** Decorative-only accent color for this card — see StatTone above. */
  tone?: StatTone;
  icon?: React.ReactNode;
}) {
  const statusStyle = status ? STATUS_STYLES[status] : null;
  const toneStyle = TONE_STYLES[tone];
  const glow = `rgba(var(${toneStyle.glowVar}), 1)`;

  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `rgba(var(${toneStyle.glowVar}), 0.28)`,
        background: `radial-gradient(120% 140% at 100% 0%, rgba(var(${toneStyle.glowVar}), 0.16), transparent 60%), var(--surface)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {icon && (
          <span
            className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
            style={{ backgroundColor: `rgba(var(${toneStyle.glowVar}), 0.16)`, color: glow }}
          >
            {icon}
          </span>
        )}
        {sublabel && (
          <span
            title={sublabel}
            className="fl-mono min-w-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `rgba(var(${toneStyle.glowVar}), 0.14)`, color: glow }}
          >
            {sublabel}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink">{value}</p>

      {statusStyle && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
            <span className="text-ink-muted">{statusStyle.label}</span>
          </span>
        </div>
      )}

      <p className="mt-2 border-t border-border pt-2 text-xs leading-snug text-ink-faint">{description}</p>
    </div>
  );
}
