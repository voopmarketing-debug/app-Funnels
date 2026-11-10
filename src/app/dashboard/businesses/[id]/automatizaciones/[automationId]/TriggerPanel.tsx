"use client";

import { useState } from "react";
import type { Trigger } from "@/lib/automations/flow";
import { defaultTrigger, TRIGGER_LABELS } from "@/lib/automations/flowEdit";
import { inputClass, type EditorData } from "./StepForm";

// "Disparadores": what makes the flow start. Any one of them is enough.

const TYPES = Object.keys(TRIGGER_LABELS) as Trigger["type"][];

const HELP: Record<Trigger["type"], string> = {
  new_conversation: "La primera vez que una persona te escribe por WhatsApp.",
  message: "Cuando el mensaje del cliente trae alguna de estas palabras.",
  stage_changed: "Cuando alguien de tu equipo (o tu agente de IA) mueve al lead a esa etapa.",
  tag_added: "Cuando tu equipo le pone esa etiqueta al lead.",
  appointment_booked: "Cuando el lead agenda una cita, por tu página o en el chat.",
};

function TriggerCard({ index, trigger, data, onChange, onRemove }: { index: number; trigger: Trigger; data: EditorData; onChange: (t: Trigger) => void; onRemove: () => void }) {
  const id = `trigger-${index}`;
  return (
    <li className="space-y-2.5 rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{TRIGGER_LABELS[trigger.type]}</p>
        <button type="button" onClick={onRemove} className="flex-none rounded-lg px-2 py-1 text-xs font-semibold text-[#d03b3b] transition hover:bg-[#d03b3b]/10" aria-label={`Quitar el disparador ${index + 1}`}>
          Quitar
        </button>
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">{HELP[trigger.type]}</p>
      {trigger.type === "message" && (
        <div className="space-y-2">
          <label htmlFor={`${id}-keywords`} className="block text-xs font-semibold text-ink-muted">
            Palabras o frases (una por línea)
          </label>
          <textarea
            id={`${id}-keywords`}
            value={trigger.keywords.join("\n")}
            onChange={(e) => onChange({ ...trigger, keywords: e.target.value.split("\n").slice(0, 20) })}
            onBlur={(e) => onChange({ ...trigger, keywords: e.target.value.split("\n").map((k) => k.trim()).filter(Boolean) })}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder={"precio\ncuánto cuesta"}
          />
          <label htmlFor={`${id}-match`} className="block text-xs font-semibold text-ink-muted">
            El mensaje…
          </label>
          <select id={`${id}-match`} value={trigger.match ?? "contains"} onChange={(e) => onChange({ ...trigger, match: e.target.value as "contains" | "exact" })} className={inputClass}>
            <option value="contains">Contiene la palabra (aunque tenga más texto)</option>
            <option value="exact">Es exactamente la palabra</option>
          </select>
          <p className="text-xs text-ink-faint">No importan las mayúsculas ni las tildes.</p>
        </div>
      )}
      {trigger.type === "stage_changed" && (
        <div className="space-y-1">
          <label htmlFor={`${id}-stage`} className="block text-xs font-semibold text-ink-muted">
            Etapa
          </label>
          <select id={`${id}-stage`} value={trigger.stageId} onChange={(e) => onChange({ ...trigger, stageId: e.target.value })} className={inputClass}>
            {data.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.pipelineName}
              </option>
            ))}
          </select>
        </div>
      )}
      {trigger.type === "tag_added" && (
        <div className="space-y-1">
          <label htmlFor={`${id}-tag`} className="block text-xs font-semibold text-ink-muted">
            Etiqueta
          </label>
          <input id={`${id}-tag`} value={trigger.tag} onChange={(e) => onChange({ ...trigger, tag: e.target.value })} maxLength={40} className={inputClass} />
        </div>
      )}
    </li>
  );
}

export function TriggerPanel({ triggers, data, onChange }: { triggers: Trigger[]; data: EditorData; onChange: (t: Trigger[]) => void }) {
  const [adding, setAdding] = useState(false);
  const free = TYPES.filter((t) => !(["new_conversation", "appointment_booked"].includes(t) && triggers.some((x) => x.type === t)));
  return (
    <section aria-labelledby="triggers-title" className="fl-card space-y-3 p-4">
      <div>
        <h2 id="triggers-title" className="text-base font-semibold text-ink">
          Disparadores
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">Qué hace que el flujo empiece. Con que pase uno basta. Un chat solo puede estar en un flujo a la vez.</p>
      </div>
      {triggers.length === 0 && <p className="rounded-lg border border-[#fab219]/50 bg-[#fab219]/10 px-3 py-2 text-xs text-ink">Sin disparador, el flujo nunca empieza. Agrega uno.</p>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {triggers.map((t, i) => (
          <TriggerCard key={i} index={i} trigger={t} data={data} onChange={(next) => onChange(triggers.map((x, j) => (j === i ? next : x)))} onRemove={() => onChange(triggers.filter((_, j) => j !== i))} />
        ))}
      </ul>
      {adding ? (
        <ul className="space-y-1 rounded-xl border border-border bg-background p-1.5" role="menu" aria-label="Elige un disparador">
          {free.map((type) => (
            <li key={type}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAdding(false);
                  onChange([...triggers, defaultTrigger(type, data.stages[0]?.id ?? "")]);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-surface-2"
              >
                {TRIGGER_LABELS[type]}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setAdding(false)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-ink-muted transition hover:bg-surface-2">
              Cancelar
            </button>
          </li>
        </ul>
      ) : (
        <button type="button" onClick={() => setAdding(true)} disabled={triggers.length >= 10} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-40">
          + Disparador
        </button>
      )}
    </section>
  );
}
