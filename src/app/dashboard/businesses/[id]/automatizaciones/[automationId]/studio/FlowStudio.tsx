"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { askConfirm } from "@/components/ConfirmHost";
import { checkFlow, checkTriggers, type Flow, type Step, type Trigger } from "@/lib/automations/flow";
import { removeStep, slotsOf, triggerSummary, updateStep } from "@/lib/automations/flowEdit";
import { flowIssues } from "@/lib/automations/stepIssues";
import { saveAutomation, setAutomationEnabled } from "@/lib/automations/automationActions";
import { StepIcon } from "../../StepIcon";
import { STEP_META } from "../../stepMeta";
import { StepForm, inputClass, type EditorData } from "../StepForm";
import { TriggerPanel } from "../TriggerPanel";
import { StudioCanvas } from "./StudioCanvas";

// The flow editor as a full-screen window: a bar on top (name, switch, cancel,
// save, close), the canvas filling the rest and, when a card is touched, a
// panel on the right with that step's form. Nothing is saved until "Guardar".

type Props = {
  businessId: string;
  automationId: string;
  initialName: string;
  initialEnabled: boolean;
  initialTriggers: Trigger[];
  /** Already laid out (every step has a position). */
  initialFlow: Flow;
  data: EditorData;
  canEdit: boolean;
  whatsappConnected: boolean;
  backHref: string;
};

const snapshot = (name: string, triggers: Trigger[], flow: Flow) => JSON.stringify({ name, triggers, flow });
const HISTORY_LIMIT = 60;
// The width of the panel on the right (sm: and up; on a phone it takes the whole screen).
const PANEL_WIDTH = 400;

export function FlowStudio({ businessId, automationId, initialName, initialEnabled, initialTriggers, initialFlow, data, canEdit, whatsappConnected, backHref }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers);
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [history, setHistory] = useState<{ past: Flow[]; future: Flow[] }>({ past: [], future: [] });
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(() => snapshot(initialName, initialTriggers, initialFlow));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = snapshot(name, triggers, flow) !== saved;

  // Full screen: the page behind doesn't scroll.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const issues = useMemo(() => flowIssues(flow), [flow]);
  const problems = useMemo(() => {
    const out: string[] = [];
    const t = checkTriggers(triggers);
    if (triggers.length === 0) out.push("Agrega al menos un disparador (la tarjeta verde de la izquierda).");
    else if (!t.ok) out.push(...t.errors.slice(0, 2));
    const stepCount = Object.keys(issues).length;
    if (stepCount > 0) out.push(`${stepCount === 1 ? "1 paso necesita" : `${stepCount} pasos necesitan`} que lo completes (marcados con ⚠).`);
    if (stepCount === 0) {
      const f = checkFlow(flow);
      if (!f.ok) out.push(...f.errors.slice(0, 2));
    }
    return out;
  }, [triggers, flow, issues]);

  const triggerSummaries = useMemo(() => triggers.map((t) => triggerSummary(t, (id) => data.stages.find((s) => s.id === id)?.name ?? null)), [triggers, data.stages]);

  const show = (tone: "ok" | "error", text: string) => setMessage({ tone, text });

  // Typing in one field makes many changes in a row: they count as one step to undo.
  const lastEdit = useRef<{ key: string; at: number } | null>(null);

  function commit(next: Flow, mergeKey?: string) {
    // A change that changes nothing (a field losing focus) isn't one: it would clear "Rehacer".
    if (next === flow || JSON.stringify(next) === JSON.stringify(flow)) return;
    const now = Date.now();
    const merge = !!mergeKey && lastEdit.current?.key === mergeKey && now - lastEdit.current.at < 1500;
    lastEdit.current = mergeKey ? { key: mergeKey, at: now } : null;
    setHistory((h) => ({ past: merge ? h.past : [...h.past.slice(-(HISTORY_LIMIT - 1)), flow], future: [] }));
    setFlow(next);
    setMessage(null);
  }
  function undo() {
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [flow, ...history.future] });
    setFlow(previous);
  }
  function redo() {
    const [next, ...rest] = history.future;
    if (!next) return;
    setHistory({ past: [...history.past, flow], future: rest });
    setFlow(next);
  }

  const selectedStep = selectedId && selectedId !== "trigger" ? (flow.steps[selectedId] ?? null) : null;
  const panel: "trigger" | "step" | null = selectedId === "trigger" ? "trigger" : selectedStep ? "step" : null;

  function onStepChange(step: Step) {
    const result = updateStep(flow, step, { prune: false });
    if (!result.ok) return show("error", result.error);
    commit(result.flow, `step:${step.id}`);
  }

  async function removeSelected(step: Step) {
    const branches = slotsOf(step).filter((s) => s.target).length;
    const needsAsk = branches > 1 || step.type === "list" || (step.type === "message" && !!step.buttons?.length);
    if (needsAsk && !(await askConfirm({ title: "Quitar este paso", message: "Las flechas que salen de este paso se quitan con él. ¿Seguro?", confirmLabel: "Quitar", tone: "danger" }))) return;
    const result = removeStep(flow, step.id, { prune: false });
    if (!result.ok) return show("error", result.error);
    setSelectedId(null);
    commit(result.flow);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveAutomation(businessId, automationId, { name, triggers, definition: flow });
      if (!res.ok) return show("error", res.error);
      setSaved(snapshot(name, triggers, flow));
      setEnabled(res.enabled);
      if (enabled && !res.enabled) show("error", `Se guardó, pero el flujo se apagó porque quedó incompleto: ${res.problems[0] ?? "revisa los pasos"}`);
      else show("ok", "Guardado.");
    });
  }

  function toggleEnabled() {
    const next = !enabled;
    const turn = () =>
      startTransition(async () => {
        const res = await setAutomationEnabled(businessId, automationId, next);
        if (!res.ok) return show("error", res.error);
        setEnabled(next);
        show("ok", next ? "El flujo está encendido: empezará con los próximos chats." : "El flujo está apagado.");
      });
    // The version being switched on is the one saved: save first if there are changes.
    if (next && dirty) {
      startTransition(async () => {
        const first = await saveAutomation(businessId, automationId, { name, triggers, definition: flow });
        if (!first.ok) return show("error", first.error);
        setSaved(snapshot(name, triggers, flow));
        turn();
      });
    } else turn();
  }

  async function close() {
    if (dirty && !(await askConfirm({ title: "Salir sin guardar", message: "Tienes cambios sin guardar. Si sales ahora, se pierden.", confirmLabel: "Salir sin guardar", tone: "danger" }))) return;
    router.push(backHref);
  }

  const bar = "flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold transition disabled:opacity-50";

  return (
    <div role="dialog" aria-modal="true" aria-label="Editor del flujo" className="fixed inset-0 z-[70] flex flex-col bg-background">
      <header className="flex flex-none items-center gap-x-2 border-b border-border bg-surface px-3 py-2 sm:gap-x-3 sm:px-4">
        <label htmlFor="studio-name" className="sr-only">
          Nombre del flujo
        </label>
        <input
          id="studio-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          disabled={!canEdit}
          className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-bold text-ink outline-none transition hover:border-border focus:border-accent sm:max-w-sm sm:flex-none sm:basis-80"
        />
        {dirty && <span className="hidden flex-none text-xs font-medium text-[#b97800] sm:inline">Cambios sin guardar</span>}
        <div className="ml-auto flex flex-none items-center gap-2">
          {canEdit && (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Encender el flujo"
              onClick={toggleEnabled}
              disabled={pending || !whatsappConnected}
              title={whatsappConnected ? undefined : "Conecta tu WhatsApp para activar flujos"}
              className={`${bar} gap-2 bg-surface text-ink`}
            >
              <span className={`relative h-5 w-9 flex-none rounded-full border transition ${enabled ? "border-accent bg-accent" : "border-border-strong bg-surface-2"}`}>
                <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
              </span>
              <span className="hidden sm:inline">{enabled ? "Encendido" : "Apagado"}</span>
            </button>
          )}
          <button type="button" onClick={close} className={`${bar} hidden text-ink-muted hover:text-ink sm:flex`}>
            Cancelar
          </button>
          {canEdit && (
            <button type="button" onClick={save} disabled={pending || !dirty} className={`${bar} border-accent bg-accent text-accent-ink hover:bg-accent-hover`}>
              {pending ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
            </button>
          )}
          <button type="button" onClick={close} aria-label="Cerrar el editor" className={`${bar} w-9 px-0 text-lg text-ink-muted hover:text-ink`}>
            ✕
          </button>
        </div>
      </header>

      <div aria-live="polite" className="flex-none empty:hidden">
        {message && <p className={`border-b px-4 py-2 text-sm ${message.tone === "ok" ? "border-accent/40 bg-accent/10 text-ink" : "border-[#d03b3b]/40 bg-[#d03b3b]/10 text-ink"}`}>{message.text}</p>}
        {!message && !canEdit && <p className="border-b border-border bg-surface px-4 py-2 text-sm text-ink-muted">No tienes permiso para cambiar flujos: puedes verlo, pero no modificarlo. Pídeselo al dueño del negocio.</p>}
        {!message && canEdit && !whatsappConnected && <p className="border-b border-[#fab219]/50 bg-[#fab219]/10 px-4 py-2 text-sm text-ink">Para encender un flujo primero conecta tu WhatsApp en la página del negocio.</p>}
        {!message && canEdit && whatsappConnected && problems.length > 0 && !enabled && (
          <p className="border-b border-border bg-surface px-4 py-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">Para poder encenderlo falta: </span>
            {problems.join(" ")}
          </p>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <StudioCanvas
          flow={flow}
          triggerSummaries={triggerSummaries}
          issues={issues}
          selectedId={selectedId}
          readOnly={!canEdit}
          data={data}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          rightInset={panel ? PANEL_WIDTH : 0}
          onSelect={setSelectedId}
          onChange={commit}
          onError={(text) => show("error", text)}
          onUndo={undo}
          onRedo={redo}
        />

        {panel && (
          <aside aria-label={panel === "trigger" ? "Disparadores" : "Editar el paso"} className="absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-border bg-surface shadow-2xl sm:w-[400px]">
            <div className="flex flex-none items-center gap-3 border-b border-border px-4 py-3">
              {panel === "step" && selectedStep ? (
                <>
                  <StepIcon type={selectedStep.type} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{STEP_META[selectedStep.type].label}</p>
                    <p className="truncate text-xs text-ink-muted">{STEP_META[selectedStep.type].hint}</p>
                  </div>
                </>
              ) : (
                <p className="min-w-0 flex-1 text-sm font-bold text-ink">⚡ Disparadores</p>
              )}
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar el panel" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-4 border-0 p-0">
                {panel === "trigger" && <TriggerPanel triggers={triggers} data={data} onChange={setTriggers} />}
                {panel === "step" && selectedStep && (
                  <>
                    {(issues[selectedStep.id] ?? []).length > 0 && (
                      <ul className="space-y-1 rounded-xl border border-[#fab219]/50 bg-[#fab219]/10 p-3 text-xs text-ink">
                        {(issues[selectedStep.id] ?? []).map((issue, i) => (
                          <li key={i}>⚠ {issue}</li>
                        ))}
                      </ul>
                    )}
                    <StepForm key={selectedStep.id} step={selectedStep} flow={flow} data={data} onChange={onStepChange} />
                    {canEdit && (
                      <button type="button" onClick={() => removeSelected(selectedStep)} className={`${inputClass} text-center font-semibold text-[#d03b3b] hover:bg-[#d03b3b]/10`}>
                        Quitar este paso
                      </button>
                    )}
                  </>
                )}
              </fieldset>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
