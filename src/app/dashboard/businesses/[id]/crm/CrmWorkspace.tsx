"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stageStyle } from "@/lib/crmStages";
import { CrmBoard, type CrmStage, type CrmConversation } from "../CrmBoard";
import { ContactsTable } from "../ContactsTable";
import { BroadcastDialog } from "./BroadcastDialog";

type DateFilter = "all" | "today" | "yesterday" | "7d" | "30d";
type Preset = "all" | "pending" | "unread" | "appointment";

const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "Todo el tiempo" },
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
];

const PRESETS: { key: Preset; label: string; dot: string }[] = [
  { key: "all", label: "Todos los contactos", dot: "bg-accent" },
  { key: "pending", label: "Sin respuesta", dot: "bg-amber-400" },
  { key: "unread", label: "No leídos", dot: "bg-sky-400" },
  { key: "appointment", label: "Con cita agendada", dot: "bg-accent-secondary" },
];

type Filters = {
  query: string;
  preset: Preset;
  stageIds: string[];
  tags: string[];
  created: DateFilter;
  activity: DateFilter;
};

const EMPTY: Filters = { query: "", preset: "all", stageIds: [], tags: [], created: "all", activity: "all" };

const DAY = 86_400_000;
const BOGOTA_OFFSET = 5 * 3_600_000; // UTC-5 all year, no DST

function inRange(iso: string | undefined | null, key: DateFilter, now: number): boolean {
  if (key === "all") return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const startOfToday = Math.floor((now - BOGOTA_OFFSET) / DAY) * DAY + BOGOTA_OFFSET;
  if (key === "today") return t >= startOfToday;
  if (key === "yesterday") return t >= startOfToday - DAY && t < startOfToday;
  if (key === "7d") return t >= startOfToday - 6 * DAY;
  return t >= startOfToday - 29 * DAY;
}

/**
 * Tablero + Lista with Kommo's "Buscar y filtrar": quick presets, date,
 * stage and tag filters, live result count, and a broadcast aimed at
 * exactly the contacts left on screen.
 */
export function CrmWorkspace({
  view,
  businessId,
  stages,
  conversations,
  templates,
  stageCounts,
  totalConversations,
}: {
  view: "board" | "list";
  businessId: string;
  stages: CrmStage[];
  conversations: CrmConversation[];
  templates: { id: string; name: string; bodyText: string }[];
  stageCounts: Record<string, number>;
  totalConversations: number;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  // "Now" for the date filters — captured when one is picked, not during render.
  const [now, setNow] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversations) for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return conversations.filter((c) => {
      if (filters.preset === "pending" && c.lastMessage?.from !== "customer") return false;
      if (filters.preset === "unread" && c.unreadCount === 0) return false;
      if (filters.preset === "appointment" && !c.appointmentAt) return false;
      if (filters.stageIds.length > 0 && !filters.stageIds.includes(c.stageId)) return false;
      if (filters.tags.length > 0 && !filters.tags.every((t) => (c.tags ?? []).includes(t))) return false;
      if (!inRange(c.createdAt, filters.created, now)) return false;
      if (!inRange(c.lastMessageAt, filters.activity, now)) return false;
      if (q) {
        const hit =
          (c.customerName ?? "").toLowerCase().includes(q) ||
          (c.customerEmail ?? "").toLowerCase().includes(q) ||
          (digits.length >= 3 && c.customerPhone.includes(digits)) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [conversations, filters, now]);

  function update(patch: Partial<Filters>) {
    if (patch.created !== undefined || patch.activity !== undefined) setNow(Date.now());
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggle(list: "stageIds" | "tags", value: string) {
    setFilters((prev) => ({
      ...prev,
      [list]: prev[list].includes(value) ? prev[list].filter((v) => v !== value) : [...prev[list], value],
    }));
  }

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "";
  const dateLabel = (key: DateFilter) => DATE_OPTIONS.find((o) => o.key === key)?.label ?? "";
  const presetInfo = PRESETS.find((p) => p.key === filters.preset)!;

  // Removable chips for everything active, also used to name the broadcast.
  const chips: { label: string; clear: () => void }[] = [
    ...(filters.preset !== "all" ? [{ label: presetInfo.label, clear: () => update({ preset: "all" }) }] : []),
    ...filters.stageIds.map((id) => ({ label: `Etapa: ${stageName(id)}`, clear: () => toggle("stageIds", id) })),
    ...filters.tags.map((t) => ({ label: `#${t}`, clear: () => toggle("tags", t) })),
    ...(filters.created !== "all" ? [{ label: `Creado: ${dateLabel(filters.created)}`, clear: () => update({ created: "all" }) }] : []),
    ...(filters.activity !== "all" ? [{ label: `Actividad: ${dateLabel(filters.activity)}`, clear: () => update({ activity: "all" }) }] : []),
    ...(filters.query.trim() ? [{ label: `“${filters.query.trim()}”`, clear: () => update({ query: "" }) }] : []),
  ];
  const isFiltered = chips.length > 0;
  const audienceLabel = chips.map((c) => c.label).join(" · ").slice(0, 200);

  return (
    <div className="space-y-3">
      <div ref={rootRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex flex-none items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/25"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${presetInfo.dot}`} />
            {presetInfo.label}
          </button>
          <label className="flex min-w-[12rem] flex-1 items-center gap-2 px-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 flex-none text-ink-faint" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
              onFocus={() => setOpen(true)}
              placeholder="Buscar y filtrar"
              aria-label="Buscar y filtrar contactos"
              className="h-8 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint md:text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`flex flex-none items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
              open || isFiltered ? "border-accent/50 text-accent" : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filtros{isFiltered ? ` (${chips.length})` : ""}
          </button>
          <div className="ml-auto flex flex-none items-center gap-2 pl-1">
            <span className="whitespace-nowrap text-xs text-ink-muted">
              <span className="font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "contacto" : "contactos"}
            </span>
            {isFiltered && filtered.length > 0 && (
              <BroadcastDialog
                businessId={businessId}
                stages={stages}
                templates={templates}
                stageCounts={stageCounts}
                totalConversations={totalConversations}
                audience={{ ids: filtered.map((c) => c.id), label: audienceLabel }}
                triggerLabel={`📢 Difusión a ${filtered.length}`}
                triggerClassName="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
              />
            )}
          </div>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 grid max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl md:grid-cols-[13rem_minmax(0,1fr)_15rem]">
            <div className="border-b border-border p-2 md:border-b-0 md:border-r">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => update({ preset: p.key })}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition ${
                    filters.preset === p.key ? "bg-accent/10 font-semibold text-accent" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className={`h-2 w-2 flex-none rounded-full ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>

            <div className="space-y-4 border-b border-border p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Propiedades</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-ink-muted">Fecha de creación</span>
                  <select
                    value={filters.created}
                    onChange={(e) => update({ created: e.target.value as DateFilter })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    {DATE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-ink-muted">Última actividad</span>
                  <select
                    value={filters.activity}
                    onChange={(e) => update({ activity: e.target.value as DateFilter })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    {DATE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-ink-muted">Etapas</span>
                <div className="flex flex-wrap gap-1.5">
                  {stages.map((s) => {
                    const active = filters.stageIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle("stageIds", s.id)}
                        className={`fl-chip flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${active ? "font-semibold" : ""}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${stageStyle(s.position).dot}`} />
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Etiquetas</p>
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Buscar etiqueta"
                aria-label="Buscar etiqueta"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {allTags
                  .filter(([t]) => t.toLowerCase().includes(tagQuery.trim().toLowerCase()))
                  .map(([tag, count]) => {
                    const active = filters.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle("tags", tag)}
                        className={`fl-chip flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${active ? "font-semibold" : ""}`}
                      >
                        <span className="truncate">{tag}</span>
                        <span className="flex-none text-ink-faint">{count}</span>
                      </button>
                    );
                  })}
                {allTags.length === 0 && <p className="text-xs text-ink-faint">Aún no hay etiquetas. Agrégalas desde la ficha del contacto.</p>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 md:col-span-3">
              <button
                type="button"
                onClick={() => setFilters(EMPTY)}
                className="text-xs font-semibold text-ink-muted transition hover:text-ink"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
              >
                Ver {filtered.length} {filtered.length === 1 ? "contacto" : "contactos"}
              </button>
            </div>
          </div>
        )}
      </div>

      {isFiltered && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span key={chip.label} className="flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink">
              {chip.label}
              <button type="button" onClick={chip.clear} aria-label={`Quitar filtro ${chip.label}`} className="text-ink-faint hover:text-ink">
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setFilters(EMPTY)} className="px-1 text-xs font-semibold text-accent hover:underline">
            Limpiar todo
          </button>
        </div>
      )}

      {view === "board" ? (
        <CrmBoard businessId={businessId} stages={stages} conversations={filtered} />
      ) : (
        <ContactsTable businessId={businessId} stages={stages} conversations={filtered} />
      )}
    </div>
  );
}
