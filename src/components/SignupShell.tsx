import type { ReactNode } from "react";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

// Shared frame for the sign-up flow (crear cuenta → activar prueba) and the
// login. On desktop it's two columns: the "why" (aside) next to the form, so
// the card stays short instead of one long narrow column. On phones the
// aside is hidden and only the form shows.
export function SignupShell({
  aside,
  step,
  topRight,
  children,
}: {
  aside: ReactNode;
  step?: 1 | 2;
  topRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-10">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />
      <div className="fl-card-hero relative w-full max-w-md overflow-hidden p-0 lg:grid lg:max-w-5xl lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden flex-col gap-8 border-r border-border bg-accent/[0.06] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <FunnelsLogoMark className="h-8 w-8 flex-none" />
            <span className="font-bold tracking-tight text-ink">Funnels Labs</span>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-6">{aside}</div>
        </aside>

        <section className="space-y-6 p-6 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:invisible">
              <FunnelsLogoMark className="h-7 w-7 flex-none" />
              <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
            </div>
            {topRight}
          </div>
          {step && <Stepper step={step} />}
          {children}
        </section>
      </div>
    </main>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const steps = ["Crea tu cuenta", "Activa tu prueba"];
  const short = ["Tu cuenta", "Tu prueba"];
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold" aria-label={`Paso ${step} de 2`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] ${
                done || current ? "bg-accent text-accent-ink" : "border border-border-strong text-ink-muted"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓" : n}
            </span>
            <span className={`truncate ${current ? "text-ink" : "text-ink-muted"}`}>
              <span className="sm:hidden">{short[i]}</span>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {n < steps.length && <span className={`h-px flex-1 ${done ? "bg-accent" : "bg-border-strong"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Small "what you get" chips, used on phones where the aside is hidden. */
export function TrustChips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-ink">
          {t}
        </li>
      ))}
    </ul>
  );
}

export function CheckList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2 text-sm text-ink-muted ${className}`}>
      {items.map((f) => (
        <li key={f} className="flex gap-2.5">
          <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-ink" aria-hidden="true">
            ✓
          </span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}
