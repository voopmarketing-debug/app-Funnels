"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { askConfirm } from "@/components/ConfirmHost";
import { checkFlow, checkTriggers, type Flow, type Step, type StepType, type Trigger } from "@/lib/automations/flow";
import { addStep, removeStep, slotsOf, updateStep } from "@/lib/automations/flowEdit";
import { flowIssues } from "@/lib/automations/stepIssues";
import { saveAutomation, setAutomationEnabled } from "@/lib/automations/automationActions";
import { FlowCanvas } from "./FlowCanvas";
import { inputClass, type EditorData } from "./StepForm";
import { TriggerPanel } from "./TriggerPanel";

type Props = {
  businessId: string;
  automationId: string;
  initialName: string;
  initialEnabled: boolean;
  initialTriggers: Trigger[];
  initialFlow: Flow;
  data: EditorData;
  canEdit: boolean;
  whatsappConnected: boolean;
};

const snapshot = (name: string, triggers: Trigger[], flow: Flow) => JSON.stringify({ name, triggers, flow });

export function FlowEditor({ businessId, automationId, initialName, initialEnabled, initialTriggers, initialFlow, data, canEdit, whatsappConnected }: Props) {
  const [name, setName] = useState(initialName);
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers);
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(() => snapshot(initialName, initialTriggers, initialFlow));
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = snapshot(name, triggers, flow) !== saved;

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
    if (triggers.length === 0) out.push("Agrega al menos un disparador.");
    else if (!t.ok) out.push(...t.errors.slice(0, 2));
    const stepCount = Object.keys(issues).length;
    if (stepCount > 0) out.push(`${stepCount === 1 ? "1 paso necesita" : `${stepCount} pasos necesitan`} que lo completes (marcados con ⚠).`);
    if (stepCount === 0) {
      const f = checkFlow(flow);
      if (!f.ok) out.push(...f.errors.slice(0, 2));
    }
    return out;
  }, [triggers, flow, issues]);

  const show = (tone: "ok" | "error", text: string) => setMessage({ tone, text });

  function apply(result: { ok: true; flow: Flow; id?: string } | { ok: false; error: string }, open?: boolean) {
    if (!result.ok) return show("error", result.error);
    setFlow(result.flow);
    setMessage(null);
    if (open && result.id) setOpenId(result.id);
  }

  const onAdd = (parentId: string, key: string, type: StepType) => apply(addStep(flow, parentId, key, type, { otherAutomationId: data.automations[0]?.id }), true);
  const onChange = (step: Step) => apply(updateStep(flow, step));

  async function onRemove(id: string) {
    const step = flow.steps[id];
    const branches = slotsOf(step).filter((s) => s.target).length;
    const needsAsk = branches > 1 || step.type === "list" || (step.type === "message" && !!step.buttons?.length);
    if (needsAsk && !(await askConfirm({ title: "Quitar este paso", message: "Los caminos que salen de este paso (botones, opciones o resultados) se quitan con él. ¿Seguro?", confirmLabel: "Quitar", tone: "danger" }))) return;
    if (openId === id) setOpenId(null);
    apply(removeStep(flow, id));
  }

  function save(then?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveAutomation(businessId, automationId, { name, triggers, definition: flow });
      if (!res.ok) return show("error", res.error);
      setSaved(snapshot(name, triggers, flow));
      setEnabled(res.enabled);
      if (enabled && !res.enabled) show("error", `Se guardó, pero el flujo se apagó porque quedó incompleto: ${res.problems[0] ?? "revisa los pasos"}`);
      else show("ok", "Guardado.");
      then?.();
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
        const saved1 = await saveAutomation(businessId, automationId, { name, triggers, definition: flow });
        if (!saved1.ok) return show("error", saved1.error);
        setSaved(snapshot(name, triggers, flow));
        turn();
      });
    } else turn();
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-4">
        <Link href={`/dashboard/businesses/${businessId}/automatizaciones`} className="text-sm text-ink-muted underline hover:text-ink">
          ← Automatizaciones
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <label htmlFor="automation-name" className="block text-xs font-semibold text-ink-muted">
              Nombre del flujo
            </label>
            <input id="automation-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!canEdit} className={`${inputClass} mt-1 text-lg font-semibold`} />
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Encender el flujo"
                onClick={toggleEnabled}
                disabled={pending || !whatsappConnected}
                title={whatsappConnected ? undefined : "Conecta tu WhatsApp para activar flujos"}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                <span className={`relative h-6 w-11 flex-none rounded-full border transition ${enabled ? "border-accent bg-accent" : "border-border-strong bg-surface-2"}`}>
                  <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
                </span>
                {enabled ? "Encendido" : "Apagado"}
              </button>
              <button type="button" onClick={() => save()} disabled={pending || !dirty} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50">
                {pending ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
              </button>
            </div>
          )}
        </div>
        {!canEdit && <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-muted">Solo el dueño del negocio o la agencia pueden cambiar los flujos. Tú puedes verlo.</p>}
        {!whatsappConnected && canEdit && <p className="rounded-xl border border-[#fab219]/50 bg-[#fab219]/10 px-4 py-3 text-sm text-ink">Para encender un flujo primero conecta tu WhatsApp en la página del negocio.</p>}
        <div aria-live="polite">
          {message && <p className={`rounded-xl border px-4 py-3 text-sm ${message.tone === "ok" ? "border-accent/40 bg-accent/10 text-ink" : "border-[#d03b3b]/40 bg-[#d03b3b]/10 text-ink"}`}>{message.text}</p>}
        </div>
        {problems.length > 0 && (
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Para poder encenderlo falta:</p>
            <ul className="mt-1 space-y-0.5">
              {problems.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {/* Without permission the whole editor is read-only: nothing inside can be touched. */}
      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
        <TriggerPanel triggers={triggers} data={data} onChange={setTriggers} />
      </fieldset>
      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
        <section aria-label="Pasos del flujo" className="min-w-0 rounded-2xl border border-border bg-surface-2/40 p-4 md:p-6">
          <FlowCanvas flow={flow} data={data} issues={issues} openId={openId} onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))} onChange={onChange} onAdd={onAdd} onRemove={onRemove} />
        </section>
      </fieldset>
    </div>
  );
}
