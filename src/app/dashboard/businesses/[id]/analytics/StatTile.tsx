// Status colors are a small fixed scale with reserved meaning, never reused
// for chart series identity — see the dataviz skill's color-formula. They
// always ship with an icon-like dot + a text label, never color alone.
const STATUS_STYLES: Record<"good" | "warning" | "critical" | "neutral", { dot: string; label: string }> = {
  good: { dot: "#0ca30c", label: "Bien" },
  warning: { dot: "#fab219", label: "Atención" },
  critical: { dot: "#d03b3b", label: "Crítico" },
  neutral: { dot: "#8a8a86", label: "Sin datos" },
};

export function StatTile({
  label,
  value,
  sublabel,
  status,
  description,
}: {
  label: string;
  value: string;
  sublabel?: string;
  status?: "good" | "warning" | "critical" | "neutral";
  /** Fixed, plain-language explanation of what this number measures — shown
   * every time, not just contextually, so a non-technical business owner
   * always knows what they're looking at without having to ask. */
  description: string;
}) {
  const statusStyle = status ? STATUS_STYLES[status] : null;

  return (
    <div className="fl-card p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold text-ink">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {statusStyle && (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
            <span className="text-ink-muted">{statusStyle.label}</span>
          </span>
        )}
        {sublabel && <span className="text-ink-faint">{sublabel}</span>}
      </div>
      <p className="mt-2 border-t border-border pt-2 text-xs leading-snug text-ink-faint">{description}</p>
    </div>
  );
}
