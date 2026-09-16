// Circular progress ring used for plan usage / percentage stats across the
// dashboard. Pure SVG, no client JS needed — safe to render from a Server
// Component. Colors come from CSS custom properties via inline `style` (not
// presentation attributes) so the brand gradient always tracks the theme.
export function RingStat({
  percent,
  size = 88,
  strokeWidth = 9,
  trackColor = "var(--border)",
  gradientFrom = "var(--accent)",
  gradientTo = "var(--accent-secondary)",
  gradientId,
  children,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientId: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative inline-flex flex-none items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: gradientFrom }} />
            <stop offset="100%" style={{ stopColor: gradientTo }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} style={{ stroke: trackColor }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: `url(#${gradientId})`, transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
