"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateAgendaConfig } from "@/lib/actions";
import { shiftMonthStr, type Availability } from "@/lib/agendaAvailability";
import { formatDateInZone } from "@/lib/timezone";
import { sanitizeHexColor, readableTextColor } from "@/lib/websiteTemplate";
import { DomainSection } from "./WebsiteEditor";

/** `#RRGGBB` + a 2-digit hex alpha (e.g. "26" ≈ 15%) — used to tint the calendar with the clinic's own primary color without a CSS color-mix dependency. */
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

function waLink(contact: string): string | null {
  const digits = contact.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

type Appointment = { id: string; name: string; contact: string; startsAt: Date };

const MONTH_DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** 42 "YYYY-MM-DD" cells (6 full Monday-start weeks) covering `monthStr` plus its leading/trailing days from adjacent months. */
function getMonthGridDates(monthStr: string): string[] {
  const [year, month] = monthStr.split("-").map(Number); // month is 1-indexed here
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const offsetToMonday = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - offsetToMonday));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type DayKey = keyof Availability;
const DAY_ORDER: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const TIMEZONE_OPTIONS = [
  { value: "America/Bogota", label: "Bogotá, Lima, Quito (UTC-5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (UTC-3)" },
  { value: "America/Santiago", label: "Santiago (UTC-4/-3)" },
  { value: "America/Caracas", label: "Caracas (UTC-4)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/+2)" },
];

const SLOT_MINUTES_OPTIONS = [15, 20, 30, 45, 60, 90];

export function AgendaEditor({
  businessId,
  websiteId,
  initialConfig,
  publicUrl,
  generatedAt,
  customDomain,
  totalAppointments,
  upcomingAppointments,
  monthStr,
  monthAppointments,
}: {
  businessId: string;
  websiteId: string;
  initialConfig: { notificationEmail: string; timezone: string; slotMinutes: number; availability: Availability; primaryColor: string };
  publicUrl: string;
  generatedAt: Date;
  customDomain: string | null;
  totalAppointments: number;
  upcomingAppointments: Appointment[];
  monthStr: string;
  monthAppointments: Appointment[];
}) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const gridDates = useMemo(() => getMonthGridDates(monthStr), [monthStr]);
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of monthAppointments) {
      const key = formatDateInZone(a.startsAt, config.timezone);
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [monthAppointments, config.timezone]);
  const todayStr = formatDateInZone(new Date(), config.timezone);
  // Defaults to today so the day panel already shows something useful with
  // zero clicks — clicking any day (not just ones with appointments, so the
  // calendar behaves like a real one) just switches which day it shows.
  const activeDate = selectedDate ?? todayStr;
  const activeAppointments = appointmentsByDate.get(activeDate) ?? [];
  const editorBaseUrl = `/dashboard/businesses/${businessId}/website/${websiteId}`;
  const accent = sanitizeHexColor(config.primaryColor, "#1f6feb");
  const accentText = readableTextColor(accent);

  function setDay(day: DayKey, patch: Partial<Availability[DayKey]>) {
    setConfig((c) => ({ ...c, availability: { ...c.availability, [day]: { ...c.availability[day], ...patch } } }));
  }

  function save() {
    setSaveError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        await updateAgendaConfig(businessId, websiteId, config);
        setSaved(true);
        setPreviewKey((k) => k + 1);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <div className="fl-card flex flex-wrap items-center gap-3 p-4">
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
          {saved && (
            <span className="fl-mono rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
              ✓ Guardado — ya está en tu agenda
            </span>
          )}
          {saveError && (
            <span className="rounded-md border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-semibold text-error">
              ✕ {saveError}
            </span>
          )}
        </div>

        <div className="fl-card overflow-hidden p-0">
          <div className="grid md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{formatMonthLabel(monthStr)}</h2>
                <div className="flex items-center gap-1">
                  <Link
                    href={`${editorBaseUrl}?month=${shiftMonthStr(monthStr, -1)}`}
                    className="rounded-full border border-border px-2.5 py-1 text-sm text-ink-muted transition hover:border-accent hover:text-ink"
                    aria-label="Mes anterior"
                  >
                    ‹
                  </Link>
                  <Link
                    href={editorBaseUrl}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink"
                  >
                    Hoy
                  </Link>
                  <Link
                    href={`${editorBaseUrl}?month=${shiftMonthStr(monthStr, 1)}`}
                    className="rounded-full border border-border px-2.5 py-1 text-sm text-ink-muted transition hover:border-accent hover:text-ink"
                    aria-label="Mes siguiente"
                  >
                    ›
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {MONTH_DAY_LABELS.map((d) => (
                  <div key={d} className="fl-mono py-1 text-center text-[10px] uppercase tracking-wide text-ink-faint">
                    {d}
                  </div>
                ))}
                {gridDates.map((date) => {
                  const inMonth = date.startsWith(monthStr);
                  const appts = appointmentsByDate.get(date) ?? [];
                  const isToday = date === todayStr;
                  const isSelected = date === activeDate;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full text-sm transition ${
                        !inMonth ? "opacity-30" : ""
                      } ${isSelected ? "" : "hover:bg-surface-2"}`}
                      style={
                        isSelected
                          ? { backgroundColor: accent, color: accentText }
                          : isToday
                            ? { boxShadow: `inset 0 0 0 1.5px ${accent}`, color: accent, fontWeight: 700 }
                            : undefined
                      }
                    >
                      <span>{Number(date.slice(8, 10))}</span>
                      {appts.length > 0 && (
                        <span
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: isSelected ? accentText : accent }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 border-t border-border p-4 md:border-l md:border-t-0" style={{ backgroundColor: withAlpha(accent, "0a") }}>
              <p className="text-xs font-semibold text-ink">
                {activeDate === todayStr
                  ? "Hoy"
                  : new Date(`${activeDate}T00:00:00Z`).toLocaleDateString("es-CO", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    })}
              </p>
              {activeAppointments.length === 0 ? (
                <p className="text-xs text-ink-faint">No hay citas este día.</p>
              ) : (
                <div className="space-y-2">
                  {activeAppointments.map((a) => {
                    const wa = waLink(a.contact);
                    return (
                      <div key={a.id} className="rounded-md border border-border bg-background p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="fl-mono text-xs font-bold"
                              style={{ color: accent }}
                            >
                              {a.startsAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: config.timezone })}
                            </p>
                            <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                            <p className="fl-mono truncate text-xs text-ink-muted">{a.contact}</p>
                          </div>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Escribir por WhatsApp"
                              className="flex-none rounded-full border border-border p-1.5 text-ink-muted transition hover:border-accent hover:text-accent"
                            >
                              💬
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <Section title="Notificaciones y zona horaria" defaultOpen>
          <div className="space-y-1">
            <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">
              Correo para avisos de nuevas citas
            </label>
            <input
              type="email"
              value={config.notificationEmail}
              onChange={(e) => setConfig((c) => ({ ...c, notificationEmail: e.target.value }))}
              placeholder="tu@negocio.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <p className="text-[11px] text-ink-faint">
              Cada vez que alguien agenda aquí, te llega un correo a esta dirección — y la persona que agendó recibe
              su propia confirmación si dejó su correo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">Zona horaria</label>
              <select
                value={config.timezone}
                onChange={(e) => setConfig((c) => ({ ...c, timezone: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">Duración de la cita</label>
              <select
                value={config.slotMinutes}
                onChange={(e) => setConfig((c) => ({ ...c, slotMinutes: Number(e.target.value) }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {SLOT_MINUTES_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">Color principal</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))}
                className="h-6 w-8 flex-none cursor-pointer bg-transparent"
              />
              <input
                value={config.primaryColor}
                onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))}
                maxLength={9}
                className="fl-mono min-w-0 flex-1 bg-transparent text-xs text-ink outline-none"
              />
            </div>
          </div>
        </Section>

        <Section title="Horarios disponibles" defaultOpen>
          <p className="text-xs text-ink-muted">
            Un solo rango por día por ahora (sin descanso de almuerzo separado) — si necesitas algo más detallado,
            dinos y lo ajustamos.
          </p>
          <div className="space-y-2">
            {DAY_ORDER.map((day) => {
              const d = config.availability[day];
              return (
                <div key={day} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                  <label className="flex w-28 flex-none items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => setDay(day, { enabled: e.target.checked })}
                      className="h-4 w-4 cursor-pointer accent-accent"
                    />
                    {DAY_LABELS[day]}
                  </label>
                  <input
                    type="time"
                    value={d.start}
                    disabled={!d.enabled}
                    onChange={(e) => setDay(day, { start: e.target.value })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
                  />
                  <span className="text-xs text-ink-faint">a</span>
                  <input
                    type="time"
                    value={d.end}
                    disabled={!d.enabled}
                    onChange={(e) => setDay(day, { end: e.target.value })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
                  />
                </div>
              );
            })}
          </div>
        </Section>

        <DomainSection businessId={businessId} websiteId={websiteId} customDomain={customDomain} />
      </div>

      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <div className="fl-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-ink">Citas</h2>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Total agendadas</p>
            <p className="text-2xl font-bold text-ink">{totalAppointments}</p>
          </div>
        </div>

        {upcomingAppointments.length > 0 && (
          <div className="fl-card space-y-2 p-4">
            <h2 className="text-sm font-semibold text-ink">Próximas citas</h2>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {upcomingAppointments.map((a) => {
                const wa = waLink(a.contact);
                return (
                  <div key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-background p-3">
                    <div className="min-w-0">
                      <p className="fl-mono text-[10px] font-bold" style={{ color: accent }}>
                        {a.startsAt.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                      <p className="fl-mono truncate text-xs text-ink-muted">{a.contact}</p>
                    </div>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Escribir por WhatsApp"
                        className="flex-none rounded-full border border-border p-1.5 text-ink-muted transition hover:border-accent hover:text-accent"
                      >
                        💬
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="fl-card space-y-2 p-4">
          <p className="text-xs text-ink-muted">
            Última actualización: {generatedAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fl-mono flex-1 truncate text-xs text-accent underline-offset-2 hover:underline"
              title="Abrir la agenda real en una pestaña nueva"
            >
              {publicUrl}
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex-none text-xs font-medium text-ink-muted hover:text-ink"
            >
              {copied ? "✓" : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">
            Pega este link como &quot;Link del botón&quot; en otra página para que el botón lleve directo a agendar.
          </p>
        </div>
        <div className="fl-card overflow-hidden p-0">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Vista previa
          </div>
          <iframe key={previewKey} src={`${publicUrl}?preview=1`} className="h-[70vh] w-full" title="Vista previa de la agenda" />
        </div>
      </div>
    </div>
  );
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="fl-card group p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
