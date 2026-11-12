import Link from "next/link";

/** "Tu plan vence…": a bar at the top of the panel with the one button that fixes it. */
export function RenewalBanner({ daysLeft, expired }: { daysLeft: number; expired: boolean }) {
  const text = expired
    ? "Tu plan venció y tu agente está pausado."
    : daysLeft <= 1
      ? "Tu plan vence mañana."
      : `Tu plan vence en ${daysLeft} días.`;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--status-warn)]/40 bg-[var(--status-warn)]/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-ink">
        <span aria-hidden="true">⏳ </span>
        {text}
      </p>
      <Link href="/renovar" className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">
        Renovar
      </Link>
    </div>
  );
}
