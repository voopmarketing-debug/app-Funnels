"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateInZone, formatTimeInZone } from "@/lib/timezone";
import { timeStrToMinutes, type Availability } from "@/lib/agendaAvailability";
import { ChatIcon } from "./builderIcons";

export type WeekAppointment = {
  id: string;
  name: string;
  contact: string;
  startsAt: Date;
  durationMinutes?: number | null;
  service?: string | null;
  note?: string | null;
  professionalId?: string | null;
  professional?: { name: string } | null;
};

const HOUR_PX = 76;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// Soft colors, one per professional.
const PALETTE = ["#7c8cf8", "#34b38a", "#f59e42", "#e86a92", "#38bdf8", "#a78bfa", "#94a3b8"];
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The Monday of the week that holds `dateStr` ("YYYY-MM-DD"). */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dateStr, -((wd + 6) % 7));
}

function rangeLabel(start: string): string {
  const end = addDays(start, 6);
  const f = (s: string, withYear: boolean) =>
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`));
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const dayOnly = new Intl.DateTimeFormat("es-CO", { day: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`));
  return sameMonth ? `${dayOnly} al ${f(end, true)}` : `${f(start, false)} al ${f(end, true)}`;
}

function minutesLabel(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

type Placed = { a: WeekAppointment; start: number; end: number; lane: number; lanes: number };

/** Puts the day's appointments side by side when they overlap. */
function layoutDay(items: { a: WeekAppointment; start: number; end: number }[]): Placed[] {
  const sorted = [...items].sort((x, y) => x.start - y.start || x.end - y.end);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.lanes = lanes;
    placed.push(...group);
    group = [];
  };
  for (const it of sorted) {
    if (group.length > 0 && it.start >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.end > it.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ ...it, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length > 0) flush();
  return placed;
}

function waLink(contact: string): string | null {
  const digits = contact.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/**
 * The owner's weekly calendar: days across, hours down, each appointment a card in its professional's
 * color, a line for the current time and a filter by professional.
 */
export function AgendaWeek({
  appointments,
  professionals,
  availabilities,
  slotMinutes,
  timezone,
  accent,
  weekStart,
  onWeekChange,
}: {
  appointments: WeekAppointment[];
  professionals: { id: string; name: string }[];
  availabilities: Availability[];
  slotMinutes: number;
  timezone: string;
  accent: string;
  weekStart: string;
  onWeekChange: (monday: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  // Only after mount: the clock must not differ between server and browser.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    professionals.forEach((p, i) => map.set(p.id, PALETTE[i % PALETTE.length]));
    return (a: WeekAppointment) => (a.professionalId ? (map.get(a.professionalId) ?? PALETTE[6]) : accent);
  }, [professionals, accent]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayStr = now ? formatDateInZone(now, timezone) : "";

  const inWeek = useMemo(() => {
    const byDay = new Map<string, { a: WeekAppointment; start: number; end: number }[]>();
    for (const a of appointments) {
      if (filter !== "all" && (a.professionalId ?? "") !== filter) continue;
      const day = formatDateInZone(a.startsAt, timezone);
      if (!days.includes(day)) continue;
      const start = timeStrToMinutes(formatTimeInZone(a.startsAt, timezone));
      const list = byDay.get(day) ?? [];
      list.push({ a, start, end: start + (a.durationMinutes ?? slotMinutes) });
      byDay.set(day, list);
    }
    return byDay;
  }, [appointments, filter, days, timezone, slotMinutes]);

  // Visible hours: the opening hours of the week plus whatever is booked outside them.
  const { startHour, endHour } = useMemo(() => {
    let lo = 24 * 60;
    let hi = 0;
    for (const av of availabilities) {
      for (const k of DAY_KEYS) {
        const d = av[k];
        if (!d.enabled) continue;
        lo = Math.min(lo, timeStrToMinutes(d.start));
        hi = Math.max(hi, timeStrToMinutes(d.end));
      }
    }
    for (const list of inWeek.values()) for (const it of list) { lo = Math.min(lo, it.start); hi = Math.max(hi, it.end); }
    if (lo >= hi) { lo = 8 * 60; hi = 18 * 60; }
    return { startHour: Math.max(0, Math.floor(lo / 60) - 1), endHour: Math.min(24, Math.ceil(hi / 60) + 1) };
  }, [availabilities, inWeek]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_PX;
  const total = [...inWeek.values()].reduce((n, l) => n + l.length, 0);
  const nowMin = now && todayStr && days.includes(todayStr) ? timeStrToMinutes(formatTimeInZone(now, timezone)) : null;
  const picked = selected ? appointments.find((a) => a.id === selected) ?? null : null;
  const pickedWa = picked ? waLink(picked.contact) : null;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-bold text-ink">{rangeLabel(weekStart)}</h2>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Semana anterior" onClick={() => onWeekChange(addDays(weekStart, -7))} className="rounded-full border border-border px-2.5 py-1 text-sm text-ink-muted transition hover:border-accent hover:text-ink">‹</button>
          <button type="button" onClick={() => onWeekChange(mondayOf(todayStr || formatDateInZone(new Date(), timezone)))} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink">Hoy</button>
          <button type="button" aria-label="Semana siguiente" onClick={() => onWeekChange(addDays(weekStart, 7))} className="rounded-full border border-border px-2.5 py-1 text-sm text-ink-muted transition hover:border-accent hover:text-ink">›</button>
        </div>
      </div>

      {professionals.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por profesional">
          {[{ id: "all", name: "Todos" }, ...professionals].map((p) => {
            const on = filter === p.id;
            const c = p.id === "all" ? accent : colorOf({ professionalId: p.id } as WeekAppointment);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-transparent text-white" : "border-border text-ink-muted hover:text-ink"}`}
                style={on ? { backgroundColor: c } : undefined}
              >
                {!on && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />}
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {picked && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3" role="status">
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="font-semibold text-ink">{picked.name}</p>
            <p className="fl-mono text-xs text-ink-muted">{picked.contact}</p>
            {picked.service && <p className="text-ink">{picked.service}</p>}
            {picked.professional && <p className="text-xs text-ink-faint">{picked.professional.name}</p>}
            {picked.note && <p className="text-xs text-ink-muted">“{picked.note}”</p>}
          </div>
          <div className="flex flex-none items-center gap-2">
            {pickedWa && (
              <a href={pickedWa} target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp" className="rounded-full border border-border p-1.5 text-ink-muted transition hover:border-accent hover:text-accent">
                <ChatIcon className="h-4 w-4" />
              </a>
            )}
            <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:text-ink">Cerrar</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="max-h-[620px] overflow-auto">
          <div className="min-w-[720px]">
            <div className="sticky top-0 z-20 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-border bg-surface">
              <div />
              {days.map((d, i) => {
                const isToday = d === todayStr;
                return (
                  <div key={d} className="border-l border-border py-2 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-semibold ${isToday ? "text-white" : "text-ink-muted"}`} style={isToday ? { backgroundColor: accent } : undefined}>
                      <span>{Number(d.slice(8, 10))}</span>
                      <span className="font-medium">{DAY_NAMES[i]}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
              <div>
                {hours.map((h, i) => (
                  <div key={h} className="fl-mono pr-2 text-right text-[11px] text-ink-faint" style={{ height: HOUR_PX }}>
                    <span className={`relative ${i === 0 ? "top-0.5" : "-top-2"}`}>{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const placed = layoutDay(inWeek.get(d) ?? []);
                const isToday = d === todayStr;
                return (
                  <div
                    key={d}
                    className="relative border-l border-border"
                    style={{
                      height: gridHeight,
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
                      backgroundColor: isToday ? `${accent}0d` : undefined,
                    }}
                  >
                    {isToday && nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
                      <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }}>
                        <span className="fl-mono -ml-1 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-background">{minutesLabel(nowMin)}</span>
                        <span className="h-px flex-1 bg-ink" />
                      </div>
                    )}
                    {placed.map((p) => {
                      const c = colorOf(p.a);
                      const top = ((p.start - startHour * 60) / 60) * HOUR_PX;
                      const height = Math.max(26, ((p.end - p.start) / 60) * HOUR_PX - 3);
                      const on = selected === p.a.id;
                      return (
                        <button
                          key={p.a.id}
                          type="button"
                          onClick={() => setSelected(on ? null : p.a.id)}
                          title={`${p.a.name} · ${minutesLabel(p.start)} - ${minutesLabel(p.end)}`}
                          className={`absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left transition hover:brightness-110 ${on ? "ring-2 ring-offset-1 ring-offset-transparent" : ""}`}
                          style={{
                            top,
                            height,
                            left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                            width: `calc(${100 / p.lanes}% - 4px)`,
                            backgroundColor: `${c}30`,
                            borderLeftColor: c,
                            ...(on ? { boxShadow: `0 0 0 2px ${c}` } : {}),
                          }}
                        >
                          <span className="block truncate text-[12px] font-semibold leading-tight text-ink">{p.a.service ?? p.a.name}</span>
                          {height >= 40 && <span className="block truncate text-[11px] leading-tight text-ink-muted">{minutesLabel(p.start)} - {minutesLabel(p.end)}</span>}
                          {height >= 52 && <span className="block truncate text-[11px] leading-tight text-ink-muted">{p.a.service ? p.a.name : p.a.professional?.name}</span>}
                          {height >= 72 && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
                              Confirmada
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {total === 0 && <p className="border-t border-border px-4 py-3 text-center text-xs text-ink-faint">No hay citas esta semana.</p>}
      </div>
    </div>
  );
}
