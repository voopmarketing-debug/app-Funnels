"use client";

import { useState, useTransition } from "react";
import { updateConversationDetails } from "@/lib/actions";

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
  tags,
  notes,
  appointmentAt,
  appointmentNote,
}: {
  businessId: string;
  conversationId: string;
  customerPhone: string;
  tags: string[];
  notes: string | null;
  appointmentAt: Date | null;
  appointmentNote: string | null;
}) {
  const [, startTransition] = useTransition();
  const [tagList, setTagList] = useState(tags);
  const [tagInput, setTagInput] = useState("");
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [apptDate, setApptDate] = useState(toLocalInputValue(appointmentAt));
  const [apptNote, setApptNote] = useState(appointmentNote ?? "");
  const [savedPulse, setSavedPulse] = useState<string | null>(null);

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

  return (
    <div className="flex w-80 flex-none flex-col gap-5 overflow-y-auto border-l border-border bg-surface p-4">
      <section>
        <h3 className="fl-mono mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Contacto</h3>
        <a
          href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:underline"
        >
          Abrir en WhatsApp ↗
        </a>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="fl-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Cita agendada</h3>
          {savedPulse === "appointment" && <span className="text-[10px] text-accent">Guardado ✓</span>}
        </div>
        <input
          type="datetime-local"
          value={apptDate}
          onChange={(e) => setApptDate(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
        />
        <textarea
          value={apptNote}
          onChange={(e) => setApptNote(e.target.value)}
          placeholder="Detalle de la cita (ej. llamada de conexión, demo)..."
          rows={2}
          className="mt-2 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
        />
        <button
          onClick={saveAppointment}
          className="mt-2 rounded-md bg-accent-secondary/15 px-2.5 py-1 text-[11px] font-semibold text-accent-secondary transition hover:bg-accent-secondary/25"
        >
          Guardar cita
        </button>
        {!appointmentAt && !apptDate && (
          <p className="mt-1 text-[10px] text-ink-faint">
            Se guarda aquí manualmente — todavía no hay sincronización automática con agenda.funnelslabs.app.
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="fl-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Notas</h3>
          {savedPulse === "notes" && <span className="text-[10px] text-accent">Guardado ✓</span>}
        </div>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notas sobre este lead..."
          rows={4}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
        />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="fl-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Tags</h3>
          {savedPulse === "tags" && <span className="text-[10px] text-accent">Guardado ✓</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tagList.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-accent/70 hover:text-accent"
                aria-label={`Quitar ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          {tagList.length === 0 && <p className="text-[11px] text-ink-faint">Sin tags todavía.</p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TAG_SUGGESTIONS.filter((t) => !tagList.includes(t)).map((t) => (
            <button
              key={t}
              onClick={() => addTag(t)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-ink-muted transition hover:border-accent hover:text-accent"
            >
              + {t}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Tag personalizado..."
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
          <button
            onClick={() => addTag(tagInput)}
            className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            +
          </button>
        </div>
      </section>
    </div>
  );
}
