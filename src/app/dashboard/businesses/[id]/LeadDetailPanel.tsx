"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContactInfo, updateConversationDetails } from "@/lib/actions";
import { contactInitial, contactLabel, formatPhone, isBsuid } from "@/lib/contactDisplay";
import { LeadSalesSection } from "./LeadSalesSection";

const TAG_SUGGESTIONS = ["Lead calificado", "Cliente potencial", "Cotización enviada", "Urgente"];

function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The lead's visual detail panel — contact shortcut, appointment, notes, and
// tags — shown next to the conversation thread (CRM split view and the
// standalone conversation page). Every field saves independently as soon as
// it changes, no separate "save all" step.
export function LeadDetailPanel({
  businessId,
  conversationId,
  customerPhone,
  customerName,
  customerEmail,
  tags,
  notes,
  appointmentAt,
  appointmentNote,
  stage = null,
}: {
  businessId: string;
  conversationId: string;
  customerPhone: string;
  customerName: string | null;
  customerEmail: string | null;
  tags: string[];
  notes: string | null;
  appointmentAt: Date | null;
  appointmentNote: string | null;
  // Where this lead sits in its embudo — drawn as Kommo's stage progress bar.
  stage?: { name: string; index: number; total: number; pipelineName?: string } | null;
}) {
  const [, startTransition] = useTransition();
  // Remembered per-browser (not per-lead) — collapsing it once to read a
  // long conversation shouldn't need repeating on every contact clicked
  // afterward. Defaults open since the panel's own data (appointment,
  // notes, tags) is useful at a glance, not just on demand.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("funnels-lead-panel-collapsed") === "1");
    } catch {
      // Private browsing or storage disabled — stays expanded.
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("funnels-lead-panel-collapsed", next ? "1" : "0");
      } catch {
        // Storage disabled — the choice just won't persist across reloads.
      }
      return next;
    });
  }

  const [tagList, setTagList] = useState(tags);
  const [tagInput, setTagInput] = useState("");
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [apptDate, setApptDate] = useState(toLocalInputValue(appointmentAt));
  const [apptNote, setApptNote] = useState(appointmentNote ?? "");
  const [savedPulse, setSavedPulse] = useState<string | null>(null);
  const router = useRouter();
  const [nameValue, setNameValue] = useState(customerName ?? "");
  const [emailValue, setEmailValue] = useState(customerEmail ?? "");
  const [contactError, setContactError] = useState<string | null>(null);

  function flashSaved(field: string) {
    setSavedPulse(field);
    setTimeout(() => setSavedPulse((prev) => (prev === field ? null : prev)), 1200);
  }

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean || tagList.includes(clean)) return;
    const next = [...tagList, clean];
    setTagList(next);
    setTagInput("");
    startTransition(async () => {
      await updateConversationDetails(businessId, conversationId, { tags: next });
      flashSaved("tags");
    });
  }

  function removeTag(tag: string) {
    const next = tagList.filter((t) => t !== tag);
    setTagList(next);
    startTransition(async () => {
      await updateConversationDetails(businessId, conversationId, { tags: next });
      flashSaved("tags");
    });
  }

  // Saved on blur, like notes. The name also shows in the chat header and
  // the conversation list, so those re-render right after it changes.
  function saveContact(field: "name" | "email") {
    const value = field === "name" ? nameValue.trim() : emailValue.trim();
    const current = (field === "name" ? customerName : customerEmail) ?? "";
    if (value === current) return;
    setContactError(null);
    startTransition(async () => {
      try {
        await updateContactInfo(businessId, conversationId, field === "name" ? { name: value } : { email: value });
        flashSaved("contact");
        router.refresh();
      } catch (err) {
        setContactError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  function saveNotes() {
    startTransition(async () => {
      await updateConversationDetails(businessId, conversationId, { notes: notesValue || null });
      flashSaved("notes");
    });
  }

  function saveAppointment() {
    startTransition(async () => {
      await updateConversationDetails(businessId, conversationId, {
        appointmentAt: apptDate ? new Date(apptDate).toISOString() : null,
        appointmentNote: apptNote || null,
      });
      flashSaved("appointment");
    });
  }

  const fieldClass =
    "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-border focus:border-accent focus:bg-background";
  const displayName = contactLabel(nameValue || customerName, customerPhone);
  const appointmentChanged =
    apptDate !== toLocalInputValue(appointmentAt) || apptNote !== (appointmentNote ?? "");

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        title="Mostrar la ficha del contacto (datos, ventas, etapa, cita, notas y etiquetas)"
        className="group flex w-11 flex-none flex-col items-center gap-3 border-l border-border bg-surface py-4 text-ink-muted transition hover:bg-accent/10 hover:text-accent"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 transition group-hover:border-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
          </svg>
        </span>
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">Ver ficha del contacto</span>
        <span aria-hidden="true" className="text-lg leading-none">‹</span>
      </button>
    );
  }

  return (
    <aside className="flex w-72 flex-none xl:w-80 flex-col overflow-y-auto border-l border-border bg-surface">
      {/* Kommo-style header: who this is, at a glance. */}
      <div className="space-y-3 border-b border-border bg-surface-2/60 p-4">
        <div className="flex items-start gap-3">
          <div className="fl-mono flex h-12 w-12 flex-none items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-ink-muted">
            {contactInitial(nameValue || customerName, customerPhone).slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{displayName}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#25d366]/40 bg-[#25d366]/10 px-2 py-0.5 text-[12px] font-semibold text-[#1aa851]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" />
              WhatsApp
            </span>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Ocultar la ficha para darle más espacio a la conversación"
            aria-label="Ocultar ficha del contacto"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg text-ink-muted transition hover:bg-surface hover:text-ink"
          >
            ›
          </button>
        </div>

        {stage && (
          <div>
            <p className="text-[13px] text-ink-faint">{stage.pipelineName ? `Embudo · ${stage.pipelineName}` : "Embudo de ventas"}</p>
            <p className="text-sm font-semibold text-ink">
              {stage.name}
              <span className="ml-1.5 text-xs font-normal text-ink-faint">
                etapa {stage.index + 1} de {stage.total}
              </span>
            </p>
            <div className="mt-1.5 flex gap-1" aria-hidden="true">
              {Array.from({ length: stage.total }).map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= stage.index ? "bg-accent" : "bg-border"}`} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {tagList.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[13px] font-medium text-accent">
              #{tag}
              <button onClick={() => removeTag(tag)} className="text-accent/70 hover:text-accent" aria-label={`Quitar ${tag}`}>
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            onBlur={() => tagInput.trim() && addTag(tagInput)}
            placeholder="#agregar etiqueta"
            aria-label="Agregar etiqueta"
            className="min-w-[7rem] flex-1 rounded-md border border-dashed border-border bg-transparent px-2 py-0.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
          />
          {savedPulse === "tags" && <span className="text-[12px] text-accent">Guardado ✓</span>}
        </div>
        {TAG_SUGGESTIONS.some((t) => !tagList.includes(t)) && (
          <div className="flex flex-wrap gap-1">
            {TAG_SUGGESTIONS.filter((t) => !tagList.includes(t)).map((t) => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-faint transition hover:bg-surface hover:text-accent"
              >
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="border-b border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Datos del contacto</h3>
          {savedPulse === "contact" && <span className="text-[12px] text-accent">Guardado ✓</span>}
        </div>
        <dl className="space-y-0.5">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center">
            <dt className="text-xs text-ink-muted">Nombre</dt>
            <dd>
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => saveContact("name")}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                maxLength={120}
                placeholder="Agregar nombre"
                aria-label="Nombre del contacto"
                className={fieldClass}
              />
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center">
            <dt className="text-xs text-ink-muted">Teléfono</dt>
            <dd className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5">
              <span className="fl-mono truncate text-sm text-ink">{formatPhone(customerPhone)}</span>
              {/* No wa.me link for a username contact: Meta hides their number. */}
              {!isBsuid(customerPhone) && (
                <a
                  href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir en WhatsApp"
                  className="flex-none text-xs font-semibold text-accent hover:underline"
                >
                  Abrir ↗
                </a>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center">
            <dt className="text-xs text-ink-muted">Correo</dt>
            <dd>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onBlur={() => saveContact("email")}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                maxLength={200}
                placeholder="Agregar correo"
                aria-label="Correo electrónico"
                className={fieldClass}
              />
            </dd>
          </div>
        </dl>
        {contactError && <p className="mt-1 text-[13px] text-error">{contactError}</p>}
      </section>

      <LeadSalesSection businessId={businessId} conversationId={conversationId} />

      <section className="border-b border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Cita</h3>
          {savedPulse === "appointment" && <span className="text-[12px] text-accent">Guardado ✓</span>}
        </div>
        <dl className="space-y-0.5">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center">
            <dt className="text-xs text-ink-muted">Fecha</dt>
            <dd>
              <input
                type="datetime-local"
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                aria-label="Fecha y hora de la cita"
                className={fieldClass}
              />
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start">
            <dt className="pt-2 text-xs text-ink-muted">Detalle</dt>
            <dd>
              <textarea
                value={apptNote}
                onChange={(e) => setApptNote(e.target.value)}
                placeholder="Ej. demo, llamada…"
                aria-label="Detalle de la cita"
                rows={1}
                className={`${fieldClass} resize-none`}
              />
            </dd>
          </div>
        </dl>
        {appointmentChanged ? (
          <button
            onClick={saveAppointment}
            className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Guardar cita
          </button>
        ) : (
          !appointmentAt && (
            <p className="mt-1 px-2 text-[13px] text-ink-faint">La IA la llena sola cuando el cliente confirma fecha y hora.</p>
          )
        )}
      </section>

      <section className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Notas</h3>
          {savedPulse === "notes" && <span className="text-[12px] text-accent">Guardado ✓</span>}
        </div>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={saveNotes}
          placeholder="Escribe algo sobre este cliente… (se guarda solo)"
          rows={4}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        />
      </section>
    </aside>
  );
}
