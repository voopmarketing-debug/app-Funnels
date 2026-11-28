"use client";

import { fromPanelUrl } from "@/lib/panelBackLink";
import { TrackingSettings } from "./TrackingSettings";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateAgendaConfig, createProfessional, updateProfessional, deleteProfessional } from "@/lib/actions";
import { shiftMonthStr, type Availability } from "@/lib/agendaAvailability";
import { formatDateInZone } from "@/lib/timezone";
import { sanitizeHexColor, readableTextColor } from "@/lib/websiteTemplate";
import { DomainSection } from "./WebsiteEditor";
import { ClientDate } from "@/components/ClientDate";
import { askConfirm } from "@/components/ConfirmHost";
import { ChatIcon } from "./builderIcons";
import { ImagePicker } from "./ImagePicker";
import { AgendaWeek, mondayOf, type WeekAppointment } from "./AgendaWeek";
import { draftToParam } from "@/lib/agendaDraft";
import { AGENDA_STYLES, AGENDA_STYLE_DEFS, type AgendaStyle } from "@/lib/agendaStyles";
import { durationLabel, MAX_AGENDA_SERVICES, type AgendaService } from "@/lib/agendaServices";
import { FIELD_TYPES, FIELD_TYPE_LABELS, MAX_AGENDA_FIELDS, type AgendaField, type FieldType } from "@/lib/agendaFields";

/** `#RRGGBB` + a 2-digit hex alpha (e.g. "26" ≈ 15%) — used to tint the calendar with the clinic's own primary color without a CSS color-mix dependency. */
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

function waLink(contact: string): string | null {
  const digits = contact.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

type Appointment = WeekAppointment;

type ProfessionalData = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  photoUrl: string | null;
  active: boolean;
  availability: Availability;
  pipelineId: string | null;
};

type PipelineOption = { id: string; name: string };

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
  tracking,
  totalAppointments,
  upcomingAppointments,
  monthStr,
  initialWeek,
  monthAppointments,
  professionals,
  pipelines,
}: {
  businessId: string;
  websiteId: string;
  initialConfig: {
    notificationEmail: string;
    timezone: string;
    slotMinutes: number;
    availability: Availability;
    primaryColor: string;
    style: AgendaStyle;
    title: string;
    subtitle: string;
    address: string;
    mapUrl: string;
    logoUrl: string;
    askNote: boolean;
    services: AgendaService[];
    fields: AgendaField[];
  };
  publicUrl: string;
  generatedAt: Date;
  customDomain: string | null;
  tracking: { metaPixelId: string | null; googleTagId: string | null };
  totalAppointments: number;
  upcomingAppointments: Appointment[];
  monthStr: string;
  initialWeek: string | null;
  monthAppointments: Appointment[];
  professionals: ProfessionalData[];
  pipelines: PipelineOption[];
}) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const [view, setView] = useState<"week" | "month">("week");
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => {
    if (initialWeek) return mondayOf(initialWeek);
    const today = formatDateInZone(new Date(), initialConfig.timezone);
    return mondayOf(today.slice(0, 7) === monthStr ? today : `${monthStr}-01`);
  });
  // The preview shows what is on screen (not only what was saved): the settings travel in the URL, a moment after the last change.
  const draftNow = draftToParam(config);
  const [draft, setDraft] = useState(draftNow);
  useEffect(() => {
    const t = setTimeout(() => setDraft(draftNow), 350);
    return () => clearTimeout(t);
  }, [draftNow]);

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

  function changeWeek(monday: string) {
    setWeekStart(monday);
    // The page loads the month before and after the one in the URL; going further asks for that month.
    const last = new Date(Date.UTC(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, Number(monday.slice(8, 10)) + 6)).toISOString().slice(0, 7);
    const lo = shiftMonthStr(monthStr, -1);
    const hi = shiftMonthStr(monthStr, 1);
    if (monday.slice(0, 7) < lo || last > hi) router.push(`${editorBaseUrl}?month=${monday.slice(0, 7)}&week=${monday}`);
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="fl-card overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">Calendario de citas</h2>
          <div className="fl-seg flex" role="radiogroup" aria-label="Vista del calendario">
            {([["week", "Semana"], ["month", "Mes"]] as const).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={view === key} onClick={() => setView(key)} className="fl-seg-item px-3 py-1 text-xs">
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === "week" ? (
          <AgendaWeek
            appointments={monthAppointments}
            professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
            availabilities={[config.availability, ...professionals.map((p) => p.availability)]}
            slotMinutes={config.slotMinutes}
            timezone={config.timezone}
            accent={accent}
            weekStart={weekStart}
            onWeekChange={changeWeek}
          />
        ) : (
                <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="mx-auto w-full max-w-lg space-y-3 p-5">
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

            <div className="grid grid-cols-7 justify-items-center gap-1.5">
              {MONTH_DAY_LABELS.map((d) => (
                <div key={d} className="fl-mono py-1 text-center text-[12px] uppercase tracking-wide text-ink-faint">
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
                    className={`flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-sm transition ${
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
                            <ClientDate date={a.startsAt} options={{ hour: "2-digit", minute: "2-digit" }} timeZone={config.timezone} />
                          </p>
                          <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                          <p className="fl-mono truncate text-xs text-ink-muted">{a.contact}</p>
                          {a.service && <p className="truncate text-[13px] text-ink">{a.service}</p>}
                          {a.professional && <p className="truncate text-[13px] text-ink-faint">{a.professional.name}</p>}
                          {a.note && <p className="text-[12px] text-ink-muted">“{a.note}”</p>}
                        </div>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Escribir por WhatsApp"
                            className="flex-none rounded-full border border-border p-1.5 text-ink-muted transition hover:border-accent hover:text-accent"
                          >
                            <ChatIcon className="h-4 w-4" />
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
        )}
      </div>

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

        <Section title="Apariencia" defaultOpen>
          <div className="space-y-1.5">
            <p className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">Estilo de la página</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AGENDA_STYLES.map((id) => (
                <StyleCard key={id} id={id} accent={accent} selected={config.style === id} onSelect={() => setConfig((c) => ({ ...c, style: id }))} />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">Color principal</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
              <input type="color" value={config.primaryColor} onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))} className="h-6 w-8 flex-none cursor-pointer bg-transparent" />
              <input value={config.primaryColor} onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))} maxLength={9} className="fl-mono min-w-0 flex-1 bg-transparent text-xs text-ink outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="Logo" className="h-12 max-w-[120px] rounded-md border border-border bg-background object-contain p-1" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border-strong text-xs text-ink-faint">Logo</span>
            )}
            <button type="button" onClick={() => setLogoOpen(true)} className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent">
              {config.logoUrl ? "Cambiar logo" : "Poner logo"}
            </button>
            {config.logoUrl && (
              <button type="button" onClick={() => setConfig((c) => ({ ...c, logoUrl: "" }))} className="text-xs font-medium text-error hover:underline">
                Quitar
              </button>
            )}
          </div>
          <TextField label="Título" value={config.title} max={80} placeholder="Agenda tu cita" onChange={(v) => setConfig((c) => ({ ...c, title: v }))} />
          <TextField label="Frase de apoyo (opcional)" value={config.subtitle} max={200} placeholder="Ej: Atención personalizada, con cita previa" onChange={(v) => setConfig((c) => ({ ...c, subtitle: v }))} />
        </Section>

        <Section title="Dónde y cómo" defaultOpen>
          <TextField label="Dirección o sede" value={config.address} max={200} placeholder="Ej: Cra 15 # 93-20, consultorio 402, Bogotá" onChange={(v) => setConfig((c) => ({ ...c, address: v }))} />
          <TextField label="Link del mapa (opcional)" value={config.mapUrl} max={500} placeholder="https://maps.google.com/..." onChange={(v) => setConfig((c) => ({ ...c, mapUrl: v }))} />
        </Section>

        <Section title={`Formulario de la cita (${config.fields.length} campos)`} defaultOpen>
          <p className="text-xs text-ink-muted">Esto es lo que llena tu cliente al agendar. Cambia los textos, el orden y agrega los campos que necesites.</p>
          {config.fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              first={i === 0}
              last={i === config.fields.length - 1}
              onChange={(next) => setConfig((c) => ({ ...c, fields: c.fields.map((x, j) => (j === i ? next : x)) }))}
              onMove={(dir) =>
                setConfig((c) => {
                  const to = i + dir;
                  if (to < 0 || to >= c.fields.length) return c;
                  const copy = [...c.fields];
                  [copy[i], copy[to]] = [copy[to], copy[i]];
                  return { ...c, fields: copy };
                })
              }
              onRemove={() => setConfig((c) => ({ ...c, fields: c.fields.filter((_, j) => j !== i) }))}
            />
          ))}
          {config.fields.length < MAX_AGENDA_FIELDS && <AddFieldBar onAdd={(f) => setConfig((c) => ({ ...c, fields: [...c.fields, f] }))} />}
        </Section>

        <Section title={`Servicios (${config.services.length})`} defaultOpen={config.services.length > 0}>
          <p className="text-xs text-ink-muted">Si agregas servicios, el cliente elige uno y el calendario bloquea el tiempo que dura. Sin servicios, todas las citas duran un horario.</p>
          {config.services.map((svc, i) => (
            <ServiceRow
              key={svc.id}
              service={svc}
              onChange={(next) => setConfig((c) => ({ ...c, services: c.services.map((x, j) => (j === i ? next : x)) }))}
              onRemove={() => setConfig((c) => ({ ...c, services: c.services.filter((_, j) => j !== i) }))}
            />
          ))}
          {config.services.length < MAX_AGENDA_SERVICES && (
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, services: [...c.services, { id: Math.random().toString(36).slice(2, 10), name: "", minutes: c.slotMinutes }] }))}
              className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent"
            >
              + Agregar servicio
            </button>
          )}
        </Section>

        <Section title="Avisos y zona horaria">
          <div className="space-y-1">
            <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">
              Correo para avisos de nuevas citas
            </label>
            <input
              type="email"
              value={config.notificationEmail}
              onChange={(e) => setConfig((c) => ({ ...c, notificationEmail: e.target.value }))}
              placeholder="tu@negocio.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <p className="text-[13px] text-ink-faint">
              Cada vez que alguien agenda aquí, te llega un correo a esta dirección — y la persona que agendó recibe
              su propia confirmación si dejó su correo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">Zona horaria</label>
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
              <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">Cada cuánto hay horario</label>
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
        </Section>

        <Section title="Horarios disponibles" defaultOpen>
          <p className="text-xs text-ink-muted">
            Un solo rango por día por ahora (sin descanso de almuerzo separado) — si necesitas algo más detallado,
            dinos y lo ajustamos.
            {professionals.length > 0 && " Estos horarios generales ya no aplican — cada profesional tiene los suyos abajo."}
          </p>
          <HoursGrid availability={config.availability} onChange={setDay} />
        </Section>

        <Section title={`Profesionales (${professionals.length})`} defaultOpen={professionals.length > 0}>
          <p className="text-xs text-ink-muted">
            Si agregas al menos uno, el visitante elige con quién quiere atenderse antes de ver los horarios — y cada
            profesional solo muestra sus propias horas libres. Sin ninguno, la agenda funciona como hasta ahora.
          </p>
          {professionals.map((p) => (
            <ProfessionalRow key={p.id} businessId={businessId} professional={p} pipelines={pipelines} />
          ))}
          <NewProfessionalForm businessId={businessId} websiteId={websiteId} />
        </Section>

        <DomainSection businessId={businessId} websiteId={websiteId} customDomain={customDomain} />
        <TrackingSettings businessId={businessId} websiteId={websiteId} metaPixelId={tracking.metaPixelId} googleTagId={tracking.googleTagId} />
      </div>

      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <div className="fl-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-ink">Citas</h2>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="fl-mono text-[12px] uppercase tracking-wide text-ink-faint">Total agendadas</p>
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
                      <p className="fl-mono text-[12px] font-bold" style={{ color: accent }}>
                        <ClientDate date={a.startsAt} options={{ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }} />
                      </p>
                      <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                      <p className="fl-mono truncate text-xs text-ink-muted">{a.contact}</p>
                      {a.service && <p className="truncate text-[13px] text-ink">{a.service}</p>}
                      {a.professional && <p className="truncate text-[13px] text-ink-faint">{a.professional.name}</p>}
                    </div>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Escribir por WhatsApp"
                        className="flex-none rounded-full border border-border p-1.5 text-ink-muted transition hover:border-accent hover:text-accent"
                      >
                        <ChatIcon className="h-4 w-4" />
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
            Última actualización: <ClientDate date={generatedAt} options={{ dateStyle: "medium", timeStyle: "short" }} />
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <a
              href={fromPanelUrl(publicUrl)}
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
          <p className="text-[13px] text-ink-faint">
            Pega este link como &quot;Link del botón&quot; en otra página para que el botón lleve directo a agendar.
          </p>
        </div>
        <div className="fl-card overflow-hidden p-0">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Vista previa
          </div>
          <iframe key={`${previewKey}-${professionals.length}`} src={`${publicUrl}?preview=1&draft=${encodeURIComponent(draft)}`} className="h-[70vh] w-full" title="Vista previa de la agenda" />
        </div>
      </div>
      {logoOpen && (
        <ImagePicker
          businessId={businessId}
          title="Logo de tu negocio"
          help="Sube tu logo o elige una foto de tu biblioteca."
          current={config.logoUrl || null}
          removeLabel="Quitar el logo"
          onPick={(url) => {
            setConfig((c) => ({ ...c, logoUrl: url }));
            setLogoOpen(false);
          }}
          onRemove={config.logoUrl ? () => { setConfig((c) => ({ ...c, logoUrl: "" })); setLogoOpen(false); } : null}
          onClose={() => setLogoOpen(false)}
        />
      )}
    </div>
    </div>
  );
}

function TextField({ label, value, max, placeholder, onChange }: { label: string; value: string; max: number; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">{label}</label>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
    </div>
  );
}

/** One look of the public page, drawn small with its own colors so the owner picks by sight. */
export function StyleCard({ id, accent, selected, onSelect }: { id: AgendaStyle; accent: string; selected: boolean; onSelect: () => void }) {
  const d = AGENDA_STYLE_DEFS[id];
  const r = Math.min(d.radius, 9);
  const dayR = d.dayRadius > 100 ? 999 : 2;
  const ground = id === "cielo" ? `linear-gradient(180deg, ${accent}22, ${accent}88)` : d.bg;
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`rounded-lg border p-1.5 text-left transition ${selected ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-accent"}`}>
      <span className="block overflow-hidden" style={{ background: ground, borderRadius: r, padding: 7, border: `1px solid ${d.border}` }}>
        <span className="flex gap-1.5" style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: r, padding: 6 }}>
          <span className="grid flex-[1.2] grid-cols-4 gap-[3px]">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={{ aspectRatio: "1", borderRadius: dayR, background: i === 6 ? accent : i % 5 === 3 ? "transparent" : `${accent}30` }} />
            ))}
          </span>
          <span className="flex flex-1 flex-col gap-[3px]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ height: 9, borderRadius: Math.min(r, 4), background: i === 1 ? accent : `${accent}30` }} />
            ))}
          </span>
        </span>
      </span>
      <span className="mt-1.5 block px-0.5 text-xs font-semibold text-ink">{d.label}</span>
      <span className="block px-0.5 text-[11px] text-ink-faint">{d.hint}</span>
    </button>
  );
}

const FIXED_KEYS = ["name", "contact"];

function FieldRow({ field, first, last, onChange, onMove, onRemove }: { field: AgendaField; first: boolean; last: boolean; onChange: (next: AgendaField) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const fixed = !!field.key && FIXED_KEYS.includes(field.key);
  const [optionsText, setOptionsText] = useState((field.options ?? []).join("\n"));
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-none flex-col">
          <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label="Subir campo" className="rounded px-1.5 text-xs leading-4 text-ink-muted hover:text-ink disabled:opacity-30">▲</button>
          <button type="button" disabled={last} onClick={() => onMove(1)} aria-label="Bajar campo" className="rounded px-1.5 text-xs leading-4 text-ink-muted hover:text-ink disabled:opacity-30">▼</button>
        </div>
        <input value={field.label} maxLength={80} onChange={(e) => onChange({ ...field, label: e.target.value })} aria-label="Texto del campo" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-ink outline-none focus:border-accent" />
        <select
          value={field.type}
          disabled={fixed || field.key === "email"}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            const options = type === "select" ? (field.options && field.options.length > 0 ? field.options : ["Opción 1", "Opción 2"]) : undefined;
            if (type === "select") setOptionsText((options ?? []).join("\n"));
            onChange({ ...field, type, options });
          }}
          aria-label="Tipo de campo"
          className="rounded-md border border-border bg-background px-2 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
        <label className={`flex items-center gap-1.5 text-xs ${fixed ? "text-ink-faint" : "text-ink-muted"}`}>
          <input type="checkbox" checked={field.required} disabled={fixed} onChange={(e) => onChange({ ...field, required: e.target.checked })} className="h-4 w-4 cursor-pointer accent-accent" />
          Obligatorio
        </label>
        {field.type !== "checkbox" && field.type !== "select" && field.type !== "date" && (
          <input value={field.placeholder ?? ""} maxLength={80} onChange={(e) => onChange({ ...field, placeholder: e.target.value })} placeholder="Texto de ayuda (opcional)" aria-label="Texto de ayuda" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent" />
        )}
        {fixed ? (
          <span className="ml-auto text-[11px] text-ink-faint">Siempre se pide</span>
        ) : (
          <button type="button" onClick={onRemove} className="ml-auto text-xs font-medium text-error hover:underline">Quitar</button>
        )}
      </div>
      {field.type === "select" && (
        <div className="space-y-1 pl-7">
          <label className="fl-mono text-[11px] tracking-wide text-ink-muted uppercase">Opciones (una por línea)</label>
          <textarea
            value={optionsText}
            rows={3}
            aria-label="Opciones (una por línea)"
            onChange={(e) => {
              setOptionsText(e.target.value);
              onChange({ ...field, options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 20) });
            }}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}

function AddFieldBar({ onAdd }: { onAdd: (f: AgendaField) => void }) {
  const [type, setType] = useState<FieldType>("text");
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <select value={type} onChange={(e) => setType(e.target.value as FieldType)} aria-label="Tipo del campo nuevo" className="rounded-md border border-border bg-background px-2 py-2 text-sm text-ink outline-none focus:border-accent">
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          onAdd({
            id: Math.random().toString(36).slice(2, 10),
            type,
            label: FIELD_TYPE_LABELS[type],
            required: false,
            ...(type === "select" ? { options: ["Opción 1", "Opción 2"] } : {}),
          })
        }
        className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent"
      >
        + Agregar campo
      </button>
    </div>
  );
}

const SERVICE_MINUTES = [15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240];

function ServiceRow({ service, onChange, onRemove }: { service: AgendaService; onChange: (next: AgendaService) => void; onRemove: () => void }) {
  const options = SERVICE_MINUTES.includes(service.minutes) ? SERVICE_MINUTES : [...SERVICE_MINUTES, service.minutes].sort((a, b) => a - b);
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={service.name} maxLength={80} onChange={(e) => onChange({ ...service, name: e.target.value })} placeholder="Nombre del servicio" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-ink outline-none focus:border-accent" />
        <select value={service.minutes} onChange={(e) => onChange({ ...service, minutes: Number(e.target.value) })} aria-label="Duración" className="rounded-md border border-border bg-background px-2 py-2 text-sm text-ink outline-none focus:border-accent">
          {options.map((m) => (
            <option key={m} value={m}>{durationLabel(m)}</option>
          ))}
        </select>
        <input value={service.price ?? ""} maxLength={40} onChange={(e) => onChange({ ...service, price: e.target.value })} placeholder="Precio (opcional)" className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
      </div>
      <input value={service.description ?? ""} maxLength={200} onChange={(e) => onChange({ ...service, description: e.target.value })} placeholder="Descripción corta (opcional)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
      <button type="button" onClick={onRemove} className="text-xs font-medium text-error hover:underline">Quitar servicio</button>
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

/** The weekly hours grid — shared by the agenda-level "Horarios disponibles" section and each ProfessionalRow's own schedule. */
function HoursGrid({ availability, onChange }: { availability: Availability; onChange: (day: DayKey, patch: Partial<Availability[DayKey]>) => void }) {
  return (
    <div className="space-y-2">
      {DAY_ORDER.map((day) => {
        const d = availability[day];
        return (
          <div key={day} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
            <label className="flex w-28 flex-none items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={d.enabled}
                onChange={(e) => onChange(day, { enabled: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-accent"
              />
              {DAY_LABELS[day]}
            </label>
            <input
              type="time"
              value={d.start}
              disabled={!d.enabled}
              onChange={(e) => onChange(day, { start: e.target.value })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
            />
            <span className="text-xs text-ink-faint">a</span>
            <input
              type="time"
              value={d.end}
              disabled={!d.enabled}
              onChange={(e) => onChange(day, { end: e.target.value })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
            />
          </div>
        );
      })}
    </div>
  );
}

function ProfessionalRow({
  businessId,
  professional,
  pipelines,
}: {
  businessId: string;
  professional: ProfessionalData;
  pipelines: PipelineOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: professional.name,
    title: professional.title ?? "",
    email: professional.email ?? "",
    photoUrl: professional.photoUrl ?? "",
    active: professional.active,
    availability: professional.availability,
    pipelineId: professional.pipelineId,
  });
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  function setDay(day: DayKey, patch: Partial<Availability[DayKey]>) {
    setForm((f) => ({ ...f, availability: { ...f.availability, [day]: { ...f.availability[day], ...patch } } }));
  }

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        await updateProfessional(businessId, professional.id, form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  async function remove() {
    if (!(await askConfirm({ title: `¿Quitar a "${professional.name}"?`, message: "Sus citas ya agendadas se conservan.", confirmLabel: "Sí, quitar", tone: "danger" }))) return;
    startDeleting(async () => {
      await deleteProfessional(businessId, professional.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-3">
        {form.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.photoUrl} alt="" className="h-11 w-11 rounded-full border border-border object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border-strong text-[11px] text-ink-faint">Foto</span>
        )}
        <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent">
          {form.photoUrl ? "Cambiar foto" : "Poner foto"}
        </button>
        {form.photoUrl && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))} className="text-xs font-medium text-error hover:underline">
            Quitar
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nombre"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-ink outline-none focus:border-accent"
        />
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Especialidad (opcional)"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <label className="flex flex-none items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="h-4 w-4 cursor-pointer accent-accent"
          />
          Visible
        </label>
      </div>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        placeholder="Correo del profesional (opcional — le llega aviso cuando le agenden)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      {pipelines.length > 1 && (
        <div className="space-y-1">
          <label className="fl-mono text-[12px] tracking-wide text-ink-muted uppercase">Su embudo (CRM)</label>
          <select
            value={form.pipelineId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, pipelineId: e.target.value || null }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">Embudo por defecto del negocio</option>
            {pipelines.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
          <p className="text-[13px] text-ink-faint">
            Cuando alguien agende con {form.name || "este profesional"}, el contacto cae directo en este embudo del
            CRM en vez del general.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {expanded ? "Ocultar horario" : "Editar horario"}
      </button>
      {expanded && <HoursGrid availability={form.availability} onChange={setDay} />}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isDeleting}
          className="text-xs font-medium text-error hover:underline disabled:opacity-50"
        >
          {isDeleting ? "Quitando..." : "Quitar"}
        </button>
        {saved && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
        {error && <span className="text-xs font-medium text-error">{error}</span>}
      </div>
      {photoOpen && (
        <ImagePicker
          businessId={businessId}
          title={`Foto de ${form.name || "este profesional"}`}
          help="Sube una foto o elige una de tu biblioteca."
          current={form.photoUrl || null}
          removeLabel="Quitar la foto"
          onPick={(url) => {
            setForm((f) => ({ ...f, photoUrl: url }));
            setPhotoOpen(false);
          }}
          onRemove={form.photoUrl ? () => { setForm((f) => ({ ...f, photoUrl: "" })); setPhotoOpen(false); } : null}
          onClose={() => setPhotoOpen(false)}
        />
      )}
    </div>
  );
}

function NewProfessionalForm({ businessId, websiteId }: { businessId: string; websiteId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createProfessional(businessId, websiteId, { name });
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo agregar");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Nombre del nuevo profesional"
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent disabled:opacity-50"
      >
        {isPending ? "Agregando..." : "+ Agregar profesional"}
      </button>
      {error && <span className="text-xs font-medium text-error">{error}</span>}
    </div>
  );
}
