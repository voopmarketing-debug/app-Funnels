"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MAX_RANGE_DAYS, RANGE_PRESETS, rangeLabel, rangeLength, type DayRange } from "@/lib/socialRanges";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const pad = (n: number) => String(n).padStart(2, "0");
const ym = (day: string) => day.slice(0, 7);
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** The month's days as a Monday-first grid (null = padding). */
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  return [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`)];
}

function Month({
  month,
  today,
  start,
  end,
  hover,
  onPick,
  onHover,
}: {
  month: string;
  today: string;
  start: string | null;
  end: string | null;
  hover: string | null;
  onPick: (day: string) => void;
  onHover: (day: string | null) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  // While choosing the end, the hovered day previews the range.
  const to = end ?? (start && hover ? hover : start);
  const lo = start && to ? (start < to ? start : to) : null;
  const hi = start && to ? (start < to ? to : start) : null;
  return (
    <div className="min-w-0">
      <p className="mb-2 text-center text-sm font-semibold text-ink">
        {MONTH_NAMES[m - 1]} {y}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-faint">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5" onPointerLeave={() => onHover(null)}>
        {monthGrid(month).map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const disabled = day > today;
          const edge = day === lo || day === hi;
          const inside = lo && hi && day > lo && day < hi;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onPick(day)}
              onPointerEnter={() => onHover(day)}
              aria-pressed={edge}
              aria-label={day}
              className={`h-9 text-sm tabular-nums ${
                edge
                  ? "rounded-lg bg-accent font-semibold text-accent-ink"
                  : inside
                    ? "bg-accent/15 text-ink"
                    : disabled
                      ? "cursor-not-allowed text-ink-faint/50"
                      : `rounded-lg text-ink hover:bg-surface-2 ${day === today ? "ring-1 ring-border-strong" : ""}`
              }`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ value, today }: { value: DayRange; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(value.since);
  const [end, setEnd] = useState<string | null>(value.until);
  const [hover, setHover] = useState<string | null>(null);
  // The right-hand month; the left one is the month before.
  const [month, setMonth] = useState(ym(value.until));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function go(r: DayRange) {
    setOpen(false);
    startTransition(() => router.push(`${pathname}?desde=${r.since}&hasta=${r.until}`, { scroll: false }));
  }

  function pick(day: string) {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day < start ? start : day);
      if (day < start) setStart(day);
    }
  }

  const draft = start && end ? { since: start, until: end } : null;
  const tooLong = draft ? rangeLength(draft) > MAX_RANGE_DAYS : false;
  const activePreset = RANGE_PRESETS.find((p) => {
    const r = p.range(today);
    return r.since === value.since && r.until === value.until;
  });

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setStart(value.since);
          setEnd(value.until);
          setMonth(ym(value.until));
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent ${pending ? "opacity-70" : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="tabular-nums">{rangeLabel(value)}</span>
        {activePreset && <span className="hidden font-normal text-ink-muted sm:inline">· {activePreset.label}</span>}
        <span className="text-ink-muted" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(92vw,44rem)] rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Mes anterior">
                  ‹
                </button>
                <span className="text-xs text-ink-muted">{start && !end ? "Ahora elige el último día" : "Elige el primer día"}</span>
                <button
                  type="button"
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  disabled={month >= ym(today)}
                  className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label="Mes siguiente"
                >
                  ›
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="hidden sm:block">
                  <Month month={shiftMonth(month, -1)} today={today} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
                </div>
                <Month month={month} today={today} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-xs text-ink-muted">
                  {tooLong ? `Máximo ${MAX_RANGE_DAYS} días.` : draft ? `${rangeLabel(draft)} · ${rangeLength(draft)} días` : "Se compara con el mismo número de días justo antes."}
                </p>
                <button
                  type="button"
                  disabled={!draft || tooLong}
                  onClick={() => draft && go(draft)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5 border-border md:w-44 md:flex-col md:flex-nowrap md:gap-0.5 md:border-l md:pl-3">
              {RANGE_PRESETS.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => go(p.range(today))}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                      activePreset?.key === p.key ? "bg-accent/15 text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                    } max-md:border max-md:border-border max-md:py-1.5 max-md:text-xs`}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

