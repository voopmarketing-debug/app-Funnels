"use client";

import { useRef } from "react";
import type { Action, Flow, Rule, Step } from "@/lib/automations/flow";
import { stepTitle } from "@/lib/automations/flowEdit";
import { TAGS } from "@/lib/templateTags";
import { ACTION_LABELS, RULE_FIELDS, VALIDATION_LABELS } from "../stepMeta";

// The form of each kind of step. Every form edits a copy and hands it back
// through `onChange`; the editor decides what to do with it.

export type EditorData = {
  stages: { id: string; name: string; pipelineName: string }[];
  pipelines: { id: string; name: string }[];
  templates: { id: string; name: string }[];
  /** The other flows of this business. */
  automations: { id: string; name: string }[];
};

export const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent";
const smallButton = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-40";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Tags that can be typed in a message: [nombre del lead] and the like. */
const MESSAGE_TAGS = [...TAGS.filter((t) => ["nombre", "nombre_completo", "fecha", "hora", "enlace", "negocio"].includes(t.key)).map((t) => t.label), "teléfono", "correo"];

function TextWithTags({ id, value, onChange, rows = 3, maxLength, placeholder }: { id: string; value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (label: string) => {
    const el = ref.current;
    const tag = `[${label}]`;
    if (!el) return onChange(`${value}${tag}`);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${tag}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };
  return (
    <div className="space-y-1.5">
      <textarea id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} placeholder={placeholder} className={`${inputClass} resize-y`} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink-faint">Personaliza:</span>
        {MESSAGE_TAGS.map((label) => (
          <button key={label} type="button" onClick={() => insert(label)} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-muted transition hover:border-accent hover:text-ink">
            [{label}]
          </button>
        ))}
      </div>
    </div>
  );
}

/** The next unused id like "op3", for buttons, rows and outcomes. */
function freshId(prefix: string, used: string[]): string {
  for (let n = 1; ; n++) if (!used.includes(`${prefix}${n}`)) return `${prefix}${n}`;
}

// ---- Actions and rules ----

type ActionKey = keyof typeof ACTION_LABELS;
const actionKey = (a: Action): ActionKey => (a.kind === "set_field" ? (`set_${a.field === "name" ? "name" : a.field === "email" ? "email" : "notes"}` as ActionKey) : a.kind);

function actionFromKey(key: ActionKey, data: EditorData): Action {
  switch (key) {
    case "move_stage":
      return { kind: "move_stage", stageId: data.stages[0]?.id ?? "" };
    case "add_tag":
      return { kind: "add_tag", tag: "Interesado" };
    case "remove_tag":
      return { kind: "remove_tag", tag: "Interesado" };
    case "set_name":
      return { kind: "set_field", field: "name", value: "[nombre del lead]" };
    case "set_email":
      return { kind: "set_field", field: "email", value: "" };
    case "set_notes":
      return { kind: "set_field", field: "notes", value: "" };
    case "pause_ai":
      return { kind: "pause_ai" };
    case "resume_ai":
      return { kind: "resume_ai" };
  }
}

function ActionRow({ id, action, data, onChange, onRemove }: { id: string; action: Action; data: EditorData; onChange: (a: Action) => void; onRemove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <select id={`${id}-kind`} aria-label="Acción" value={actionKey(action)} onChange={(e) => onChange(actionFromKey(e.target.value as ActionKey, data))} className={`${inputClass} sm:w-56`}>
        {(Object.keys(ACTION_LABELS) as ActionKey[]).map((k) => (
          <option key={k} value={k}>
            {ACTION_LABELS[k]}
          </option>
        ))}
      </select>
      {action.kind === "move_stage" && (
        <select id={`${id}-stage`} aria-label="Etapa" value={action.stageId} onChange={(e) => onChange({ ...action, stageId: e.target.value })} className={`${inputClass} min-w-0 flex-1`}>
          {data.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.pipelineName}
            </option>
          ))}
        </select>
      )}
      {(action.kind === "add_tag" || action.kind === "remove_tag") && <input id={`${id}-tag`} aria-label="Etiqueta" value={action.tag} onChange={(e) => onChange({ ...action, tag: e.target.value })} maxLength={40} className={`${inputClass} min-w-0 flex-1`} />}
      {action.kind === "set_field" && (
        <input
          id={`${id}-value`}
          aria-label="Valor"
          value={action.value}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          placeholder={action.field === "email" ? "ana@correo.com" : action.field === "notes" ? "Interesado en blanqueamiento" : "Nombre"}
          className={`${inputClass} min-w-0 flex-1`}
        />
      )}
      <button type="button" onClick={onRemove} className={smallButton} aria-label="Quitar acción">
        Quitar
      </button>
    </li>
  );
}

const RULE_OPS: Record<Rule["field"], { op: string; label: string }[]> = {
  tag: [
    { op: "has", label: "Tiene" },
    { op: "has_not", label: "No tiene" },
  ],
  stage: [
    { op: "is", label: "Está en" },
    { op: "is_not", label: "No está en" },
  ],
  message: [
    { op: "contains", label: "Contiene" },
    { op: "not_contains", label: "No contiene" },
    { op: "equals", label: "Es exactamente" },
  ],
  hour: [
    { op: "gte", label: "A partir de las" },
    { op: "lte", label: "Hasta las" },
  ],
  appointment: [
    { op: "exists", label: "Tiene" },
    { op: "missing", label: "No tiene" },
  ],
  email: [
    { op: "exists", label: "Tiene" },
    { op: "missing", label: "No tiene" },
  ],
  name: [
    { op: "exists", label: "Tiene" },
    { op: "missing", label: "No tiene" },
  ],
};

function ruleFor(field: Rule["field"], data: EditorData): Rule {
  switch (field) {
    case "tag":
      return { field, op: "has", value: "Interesado" };
    case "stage":
      return { field, op: "is", value: data.stages[0]?.id ?? "" };
    case "message":
      return { field, op: "contains", value: "precio" };
    case "hour":
      return { field, op: "gte", value: 9 };
    default:
      return { field, op: "missing" };
  }
}

function RuleRow({ id, rule, data, onChange, onRemove }: { id: string; rule: Rule; data: EditorData; onChange: (r: Rule) => void; onRemove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <select id={`${id}-field`} aria-label="Dato" value={rule.field} onChange={(e) => onChange(ruleFor(e.target.value as Rule["field"], data))} className={`${inputClass} sm:w-52`}>
        {RULE_FIELDS.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>
      <select id={`${id}-op`} aria-label="Condición" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value } as Rule)} className={`${inputClass} sm:w-44`}>
        {RULE_OPS[rule.field].map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      {rule.field === "stage" && (
        <select id={`${id}-value`} aria-label="Etapa" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} className={`${inputClass} min-w-0 flex-1`}>
          {data.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.pipelineName}
            </option>
          ))}
        </select>
      )}
      {(rule.field === "tag" || rule.field === "message") && <input id={`${id}-value`} aria-label="Valor" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value } as Rule)} maxLength={100} className={`${inputClass} min-w-0 flex-1`} />}
      {rule.field === "hour" && (
        <select id={`${id}-value`} aria-label="Hora" value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} className={`${inputClass} w-32`}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h % 12 || 12}:00 {h < 12 ? "a. m." : "p. m."}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={onRemove} className={smallButton} aria-label="Quitar regla">
        Quitar
      </button>
    </li>
  );
}

// ---- The form ----

export function StepForm({ step, flow, data, onChange }: { step: Step; flow: Flow; data: EditorData; onChange: (step: Step) => void }) {
  const id = step.id;

  switch (step.type) {
    case "message": {
      const buttons = step.buttons ?? [];
      return (
        <div className="space-y-4">
          <Field label="Mensaje" htmlFor={`${id}-text`}>
            <TextWithTags id={`${id}-text`} value={step.text} onChange={(text) => onChange({ ...step, text })} maxLength={1000} />
          </Field>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-muted">Botones de respuesta (hasta 3)</p>
            {buttons.length > 0 && (
              <ul className="space-y-2">
                {buttons.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <input
                      id={`${id}-button-${b.id}`}
                      aria-label={`Texto del botón ${i + 1}`}
                      value={b.title}
                      onChange={(e) => onChange({ ...step, buttons: buttons.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x)) })}
                      maxLength={20}
                      placeholder="Ej. Sí, quiero"
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => onChange({ ...step, buttons: buttons.filter((x) => x.id !== b.id) })} className={smallButton} aria-label={`Quitar el botón ${i + 1}`}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={buttons.length >= 3 || !!step.mediaUrl}
              onClick={() => onChange({ ...step, buttons: [...buttons, { id: freshId("btn", buttons.map((b) => b.id)), title: "" }] })}
              className={smallButton}
            >
              + Agregar botón
            </button>
            <p className="text-xs leading-relaxed text-ink-faint">Cada botón abre su propio camino debajo. El cliente también puede escribir en vez de tocar: eso sigue por «Otra respuesta».</p>
          </div>
          {buttons.length === 0 && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" id={`${id}-wait`} checked={!!step.waitForReply} onChange={(e) => onChange({ ...step, waitForReply: e.target.checked })} className="mt-0.5" />
              <span>
                Esperar a que el cliente responda antes de seguir
                <span className="block text-xs text-ink-faint">Mientras espera, la IA no contesta este chat.</span>
              </span>
            </label>
          )}
          <Field label="Plantilla para cuando pasaron más de 24 horas" htmlFor={`${id}-template`} hint="WhatsApp solo deja escribir libremente dentro de las 24 horas desde que el cliente te escribió. Después necesita una plantilla aprobada. Con botones no se puede usar plantilla.">
            <select id={`${id}-template`} value={step.templateId ?? ""} onChange={(e) => onChange({ ...step, templateId: e.target.value || undefined })} disabled={buttons.length > 0} className={inputClass}>
              <option value="">Ninguna: si pasaron 24 h, el paso falla</option>
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );
    }

    case "reaction":
      return (
        <Field label="Emoji" htmlFor={`${id}-emoji`} hint="Se pone sobre el último mensaje del cliente. Solo dentro de las 24 horas.">
          <div className="flex flex-wrap items-center gap-2">
            <input id={`${id}-emoji`} value={step.emoji} onChange={(e) => onChange({ ...step, emoji: e.target.value.slice(0, 8) })} className={`${inputClass} w-24 text-center text-lg`} />
            {["👍", "❤️", "😊", "🙏", "🔥", "👀"].map((e) => (
              <button key={e} type="button" onClick={() => onChange({ ...step, emoji: e })} className="rounded-lg border border-border px-2 py-1 text-lg transition hover:border-accent" aria-label={`Usar ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </Field>
      );

    case "comment":
      return (
        <Field label="Nota interna" htmlFor={`${id}-text`} hint="Se agrega a las notas del lead. El cliente no la ve.">
          <TextWithTags id={`${id}-text`} value={step.text} onChange={(text) => onChange({ ...step, text })} maxLength={1000} />
        </Field>
      );

    case "internal":
      return (
        <Field label="Aviso para tu equipo" htmlFor={`${id}-text`} hint="Les llega como notificación en el panel y en el celular.">
          <TextWithTags id={`${id}-text`} value={step.text} onChange={(text) => onChange({ ...step, text })} rows={2} maxLength={500} />
        </Field>
      );

    case "list":
      return (
        <div className="space-y-4">
          <Field label="Mensaje" htmlFor={`${id}-text`}>
            <TextWithTags id={`${id}-text`} value={step.text} onChange={(text) => onChange({ ...step, text })} maxLength={1000} />
          </Field>
          <Field label="Texto del botón que abre el menú" htmlFor={`${id}-button`} hint="Máximo 20 letras.">
            <input id={`${id}-button`} value={step.buttonText} onChange={(e) => onChange({ ...step, buttonText: e.target.value })} maxLength={20} className={inputClass} />
          </Field>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-muted">Opciones del menú (hasta 10)</p>
            <ul className="space-y-2">
              {step.rows.map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <input
                    id={`${id}-row-${r.id}`}
                    aria-label={`Opción ${i + 1}`}
                    value={r.title}
                    onChange={(e) => onChange({ ...step, rows: step.rows.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)) })}
                    maxLength={24}
                    placeholder="Ej. Precios"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <input
                    id={`${id}-rowdesc-${r.id}`}
                    aria-label={`Descripción de la opción ${i + 1}`}
                    value={r.description ?? ""}
                    onChange={(e) => onChange({ ...step, rows: step.rows.map((x) => (x.id === r.id ? { ...x, description: e.target.value || undefined } : x)) })}
                    maxLength={72}
                    placeholder="Descripción (opcional)"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button type="button" disabled={step.rows.length <= 1} onClick={() => onChange({ ...step, rows: step.rows.filter((x) => x.id !== r.id) })} className={smallButton} aria-label={`Quitar la opción ${i + 1}`}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" disabled={step.rows.length >= 10} onClick={() => onChange({ ...step, rows: [...step.rows, { id: freshId("op", step.rows.map((r) => r.id)), title: "" }] })} className={smallButton}>
              + Agregar opción
            </button>
            <p className="text-xs leading-relaxed text-ink-faint">Cada opción abre su propio camino debajo. Solo se puede enviar dentro de las 24 horas.</p>
          </div>
        </div>
      );

    case "ai_condition":
      return (
        <div className="space-y-4">
          <Field label="Pregunta para la IA" htmlFor={`${id}-question`} hint="La IA lee lo que escribió el cliente y elige el resultado que mejor encaja. Si ninguno encaja con claridad, sigue por «Ninguna de las anteriores» en vez de adivinar.">
            <textarea id={`${id}-question`} value={step.question} onChange={(e) => onChange({ ...step, question: e.target.value })} rows={2} maxLength={300} className={`${inputClass} resize-y`} />
          </Field>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-muted">Posibles resultados (de 2 a 6)</p>
            <ul className="space-y-2">
              {step.outcomes.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2">
                  <input
                    id={`${id}-outcome-${o.id}`}
                    aria-label={`Resultado ${i + 1}`}
                    value={o.label}
                    onChange={(e) => onChange({ ...step, outcomes: step.outcomes.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                    maxLength={60}
                    placeholder="Ej. Quiere agendar"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button type="button" disabled={step.outcomes.length <= 2} onClick={() => onChange({ ...step, outcomes: step.outcomes.filter((x) => x.id !== o.id) })} className={smallButton} aria-label={`Quitar el resultado ${i + 1}`}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" disabled={step.outcomes.length >= 6} onClick={() => onChange({ ...step, outcomes: [...step.outcomes, { id: freshId("res", step.outcomes.map((o) => o.id)), label: "" }] })} className={smallButton}>
              + Agregar resultado
            </button>
          </div>
        </div>
      );

    case "pause":
      return (
        <Field label="Esperar" htmlFor={`${id}-amount`} hint="Máximo 30 días. Si el cliente escribe mientras tanto, la IA le responde y el flujo sigue esperando. La precisión es de unos minutos.">
          <div className="flex items-center gap-2">
            <input id={`${id}-amount`} type="number" min={1} value={step.amount} onChange={(e) => onChange({ ...step, amount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={`${inputClass} w-28`} />
            <select id={`${id}-unit`} aria-label="Unidad" value={step.unit} onChange={(e) => onChange({ ...step, unit: e.target.value as "minutes" | "hours" | "days" })} className={`${inputClass} w-36`}>
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
              <option value="days">días</option>
            </select>
          </div>
        </Field>
      );

    case "actions":
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-muted">Acciones (se hacen en este orden)</p>
          <ul className="space-y-2">
            {step.actions.map((a, i) => (
              <ActionRow key={i} id={`${id}-action-${i}`} action={a} data={data} onChange={(next) => onChange({ ...step, actions: step.actions.map((x, j) => (j === i ? next : x)) })} onRemove={() => onChange({ ...step, actions: step.actions.filter((_, j) => j !== i) })} />
            ))}
          </ul>
          <button type="button" disabled={step.actions.length >= 8} onClick={() => onChange({ ...step, actions: [...step.actions, { kind: "add_tag", tag: "" }] })} className={smallButton}>
            + Agregar acción
          </button>
        </div>
      );

    case "condition":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
            Sigue por «Sí se cumple» si se cumplen
            <select id={`${id}-match`} aria-label="Cuántas reglas" value={step.match} onChange={(e) => onChange({ ...step, match: e.target.value as "all" | "any" })} className={`${inputClass} w-36`}>
              <option value="all">todas</option>
              <option value="any">alguna</option>
            </select>
            de estas reglas:
          </div>
          <ul className="space-y-2">
            {step.rules.map((r, i) => (
              <RuleRow key={i} id={`${id}-rule-${i}`} rule={r} data={data} onChange={(next) => onChange({ ...step, rules: step.rules.map((x, j) => (j === i ? next : x)) })} onRemove={() => onChange({ ...step, rules: step.rules.filter((_, j) => j !== i) })} />
            ))}
          </ul>
          <button type="button" disabled={step.rules.length >= 6} onClick={() => onChange({ ...step, rules: [...step.rules, ruleFor("tag", data)] })} className={smallButton}>
            + Agregar regla
          </button>
        </div>
      );

    case "validation":
      return (
        <div className="space-y-4">
          <Field label="Qué le pides al cliente" htmlFor={`${id}-kind`}>
            <select id={`${id}-kind`} value={step.kind} onChange={(e) => onChange({ ...step, kind: e.target.value as typeof step.kind })} className={inputClass}>
              {(Object.keys(VALIDATION_LABELS) as (keyof typeof VALIDATION_LABELS)[]).map((k) => (
                <option key={k} value={k}>
                  {VALIDATION_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pregunta" htmlFor={`${id}-prompt`}>
            <TextWithTags id={`${id}-prompt`} value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} rows={2} maxLength={500} />
          </Field>
          <Field label="Si la respuesta no sirve, le decimos" htmlFor={`${id}-retry`} hint="Opcional. Si lo dejas vacío, se repite la pregunta.">
            <input id={`${id}-retry`} value={step.retryPrompt ?? ""} onChange={(e) => onChange({ ...step, retryPrompt: e.target.value || undefined })} maxLength={500} placeholder="Ese dato no parece válido, ¿lo escribes de nuevo?" className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardar la respuesta en" htmlFor={`${id}-save`}>
              <select id={`${id}-save`} value={step.saveTo ?? ""} onChange={(e) => onChange({ ...step, saveTo: (e.target.value || undefined) as typeof step.saveTo })} className={inputClass}>
                <option value="">No guardarla</option>
                <option value="name">El nombre del contacto</option>
                <option value="email">El correo del contacto</option>
                <option value="notes">Las notas del lead</option>
              </select>
            </Field>
            <Field label="Veces que se vuelve a preguntar" htmlFor={`${id}-retries`} hint="De 0 a 5. Después sigue por «Sigue sin ser válida».">
              <input id={`${id}-retries`} type="number" min={0} max={5} value={step.maxRetries ?? 2} onChange={(e) => onChange({ ...step, maxRetries: Math.min(5, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} className={inputClass} />
            </Field>
          </div>
        </div>
      );

    case "goto":
      return (
        <Field label="Saltar al paso" htmlFor={`${id}-target`} hint="Sirve para repetir una parte del flujo. Un flujo que da vueltas sin parar se detiene solo.">
          <select id={`${id}-target`} value={step.target} onChange={(e) => onChange({ ...step, target: e.target.value })} className={inputClass}>
            {Object.values(flow.steps)
              .filter((s) => s.id !== step.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {stepTitle(s)}
                </option>
              ))}
          </select>
        </Field>
      );

    case "start_flow":
      return data.automations.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no tienes otros flujos. Crea otro y vuelve aquí para pasarle la conversación.</p>
      ) : (
        <Field label="Flujo que se inicia" htmlFor={`${id}-flow`} hint="Este flujo termina y la conversación sigue en el otro.">
          <select id={`${id}-flow`} value={step.automationId} onChange={(e) => onChange({ ...step, automationId: e.target.value })} className={inputClass}>
            <option value="">Elige un flujo…</option>
            {data.automations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      );

    case "http":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Método" htmlFor={`${id}-method`}>
              <select id={`${id}-method`} value={step.method ?? "POST"} onChange={(e) => onChange({ ...step, method: e.target.value as "GET" | "POST" })} className={inputClass}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </Field>
            <Field label="Dirección" htmlFor={`${id}-url`}>
              <input id={`${id}-url`} value={step.url} onChange={(e) => onChange({ ...step, url: e.target.value })} maxLength={2000} placeholder="https://tu-sistema.com/aviso" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-ink-faint">Con POST enviamos el nombre, teléfono, correo, etiquetas y etapa del lead, y lo último que escribió. Solo direcciones públicas con https. Si la dirección falla, el flujo sigue igual.</p>
        </div>
      );

    case "round_robin":
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-muted">Reparte los leads por turnos entre estos embudos (elige al menos 2)</p>
          <ul className="space-y-1.5">
            {data.pipelines.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    id={`${id}-pipeline-${p.id}`}
                    checked={step.pipelineIds.includes(p.id)}
                    onChange={(e) => onChange({ ...step, pipelineIds: e.target.checked ? [...step.pipelineIds, p.id] : step.pipelineIds.filter((x) => x !== p.id) })}
                  />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-ink-faint">Cada lead pasa a la primera etapa del embudo que le toca. Cada embudo es el tablero de una persona de tu equipo.</p>
        </div>
      );

    case "stop":
      return <p className="text-sm text-ink-muted">El flujo termina aquí. La IA vuelve a atender este chat.</p>;
  }
}
