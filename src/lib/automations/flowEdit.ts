import { nextIds, type Flow, type Step, type StepType, type Trigger } from "./flow";

// The operations the flow editor performs, as plain functions on the flow:
// add a step into a slot, remove one without breaking the chain, change one,
// and lay the flow out as a tree for drawing. Nothing here touches the
// database or React, so every rule is tested on its own.

/** A place where a step can lead to the next one (the "arrow" coming out of it). */
export type Slot = { key: string; label: string; target: string | null };

const t = (v: string | null | undefined) => v ?? null;

/** The arrows coming out of a step, in the order they are drawn. */
export function slotsOf(step: Step): Slot[] {
  switch (step.type) {
    case "message":
      return [...(step.buttons ?? []).map((b) => ({ key: `button:${b.id}`, label: b.title, target: t(b.next) })), { key: "next", label: step.buttons?.length ? "Otra respuesta" : "Después", target: t(step.next) }];
    case "list":
      return [...step.rows.map((r) => ({ key: `row:${r.id}`, label: r.title, target: t(r.next) })), { key: "otherwise", label: "Otra respuesta", target: t(step.otherwise) }];
    case "ai_condition":
      return [...step.outcomes.map((o) => ({ key: `outcome:${o.id}`, label: o.label, target: t(o.next) })), { key: "otherwise", label: "Ninguna de las anteriores", target: t(step.otherwise) }];
    case "condition":
      return [
        { key: "yes", label: "Sí se cumple", target: t(step.yes) },
        { key: "no", label: "No se cumple", target: t(step.no) },
      ];
    case "validation":
      return [
        { key: "ok", label: "Respuesta válida", target: t(step.ok) },
        { key: "fail", label: "Sigue sin ser válida", target: t(step.fail) },
      ];
    case "goto":
    case "start_flow":
    case "stop":
      return [];
    default:
      return [{ key: "next", label: "Después", target: t(step.next) }];
  }
}

/** The step with the arrow `key` pointed at `target` (null removes the arrow). */
export function withSlot(step: Step, key: string, target: string | null): Step {
  const value = target ?? undefined;
  switch (step.type) {
    case "message":
      if (key.startsWith("button:")) return { ...step, buttons: (step.buttons ?? []).map((b) => (`button:${b.id}` === key ? { ...b, next: value } : b)) };
      return key === "next" ? { ...step, next: value } : step;
    case "list":
      if (key.startsWith("row:")) return { ...step, rows: step.rows.map((r) => (`row:${r.id}` === key ? { ...r, next: value } : r)) };
      return key === "otherwise" ? { ...step, otherwise: value } : step;
    case "ai_condition":
      if (key.startsWith("outcome:")) return { ...step, outcomes: step.outcomes.map((o) => (`outcome:${o.id}` === key ? { ...o, next: value } : o)) };
      return key === "otherwise" ? { ...step, otherwise: value } : step;
    case "condition":
      return key === "yes" ? { ...step, yes: value } : key === "no" ? { ...step, no: value } : step;
    case "validation":
      return key === "ok" ? { ...step, ok: value } : key === "fail" ? { ...step, fail: value } : step;
    case "goto":
    case "start_flow":
    case "stop":
      return step;
    default:
      return key === "next" ? { ...step, next: value } : step;
  }
}

/** Where the rest of a chain goes when a step is put in front of it. */
function continuationKey(step: Step): string | null {
  switch (step.type) {
    case "condition":
      return "yes";
    case "validation":
      return "ok";
    case "ai_condition":
      return "otherwise";
    case "list":
      return "otherwise";
    case "goto":
    case "start_flow":
    case "stop":
      return null;
    default:
      return "next";
  }
}

/** Steps that end the flow: nothing can come after them. */
export const TERMINAL_TYPES: StepType[] = ["goto", "start_flow", "stop"];

export type EditContext = {
  /** Another flow to hand the chat to, offered as the default of a new "Iniciar otro flujo" step. */
  otherAutomationId?: string;
};

/** A new step with sensible starting content, so the editor never shows an empty form. */
export function defaultStep(type: StepType, id: string, flow: Flow, ctx: EditContext = {}): Step {
  switch (type) {
    case "message":
      return { id, type, text: "Hola [nombre del lead], ¿en qué te puedo ayudar?" };
    case "reaction":
      return { id, type, emoji: "👍" };
    case "comment":
      return { id, type, text: "Escribe aquí la nota para el equipo." };
    case "internal":
      return { id, type, text: "Hay que atender a [nombre del lead]." };
    case "list":
      return {
        id,
        type,
        text: "¿Qué te interesa? Elige una opción.",
        buttonText: "Ver opciones",
        rows: [
          { id: "op1", title: "Opción 1" },
          { id: "op2", title: "Opción 2" },
        ],
      };
    case "ai_condition":
      return {
        id,
        type,
        question: "¿El cliente quiere agendar una cita?",
        outcomes: [
          { id: "si", label: "Sí quiere" },
          { id: "no", label: "No quiere" },
        ],
      };
    case "pause":
      return { id, type, amount: 10, unit: "minutes" };
    case "actions":
      return { id, type, actions: [{ kind: "add_tag", tag: "Nuevo" }] };
    case "condition":
      return { id, type, match: "all", rules: [{ field: "email", op: "missing" }] };
    case "validation":
      return { id, type, kind: "email", prompt: "¿Cuál es tu correo electrónico?", saveTo: "email" };
    case "goto":
      return { id, type, target: flow.start };
    case "start_flow":
      return { id, type, automationId: ctx.otherAutomationId ?? "" };
    case "http":
      return { id, type, url: "https://", method: "POST" };
    case "round_robin":
      return { id, type, pipelineIds: [] };
    case "stop":
      return { id, type };
  }
}

/** The next free id for a step of this kind: message_1, message_2… */
export function newStepId(flow: Flow, type: StepType): string {
  for (let n = 1; ; n++) {
    const id = `${type}_${n}`;
    if (!flow.steps[id]) return id;
  }
}

/** Every step id a step anywhere in the flow points at, including `goto` targets. */
function pointsAt(flow: Flow, id: string): { stepId: string; key: string }[] {
  const out: { stepId: string; key: string }[] = [];
  for (const step of Object.values(flow.steps)) {
    for (const slot of slotsOf(step)) if (slot.target === id) out.push({ stepId: step.id, key: slot.key });
  }
  return out;
}

/** Drops every step nothing leads to any more. */
export function pruneUnreachable(flow: Flow): Flow {
  const seen = new Set<string>();
  const queue = [flow.start];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id) || !flow.steps[id]) continue;
    seen.add(id);
    queue.push(...nextIds(flow.steps[id]));
  }
  return { start: flow.start, steps: Object.fromEntries(Object.entries(flow.steps).filter(([id]) => seen.has(id))) };
}

export type EditResult = { ok: true; flow: Flow; id?: string } | { ok: false; error: string };

/**
 * Puts a new step into the arrow `key` of `parentId`. Whatever was after that
 * arrow stays after the new step, so adding in the middle of a chain never
 * loses the rest of it. A step that ends the flow can only go at the end.
 */
export function addStep(flow: Flow, parentId: string, key: string, type: StepType, ctx: EditContext = {}): EditResult {
  const parent = flow.steps[parentId];
  if (!parent) return { ok: false, error: "El paso donde querías agregar ya no existe." };
  const slot = slotsOf(parent).find((s) => s.key === key);
  if (!slot) return { ok: false, error: "Ese lugar ya no existe." };
  if (TERMINAL_TYPES.includes(type) && slot.target) return { ok: false, error: "Este paso termina el flujo: solo se puede poner al final de un camino." };

  const id = newStepId(flow, type);
  let step = defaultStep(type, id, flow, ctx);
  const rest = slot.target;
  const carry = continuationKey(step);
  if (rest && carry) step = withSlot(step, carry, rest);
  const steps = { ...flow.steps, [id]: step, [parentId]: withSlot(parent, key, id) };
  return { ok: true, flow: { start: flow.start, steps }, id };
}

/**
 * Removes a step and joins the chain back up: whatever pointed at it now points
 * at what came after it. The branches it had of its own (buttons, conditions)
 * go away with it. The only step of a flow can't be removed.
 */
export function removeStep(flow: Flow, id: string): EditResult {
  const step = flow.steps[id];
  if (!step) return { ok: false, error: "Ese paso ya no existe." };
  if (Object.keys(flow.steps).length === 1) return { ok: false, error: "Un flujo necesita al menos un paso." };

  const carry = continuationKey(step);
  const after = carry ? (slotsOf(step).find((s) => s.key === carry)?.target ?? null) : null;
  const steps = { ...flow.steps };
  delete steps[id];
  for (const ref of pointsAt(flow, id)) {
    if (ref.stepId === id) continue;
    steps[ref.stepId] = withSlot(steps[ref.stepId], ref.key, after);
  }
  // A jump to the removed step goes where the chain went on, or to the start.
  for (const other of Object.values(steps)) {
    if (other.type === "goto" && other.target === id) steps[other.id] = { ...other, target: after ?? flow.start };
  }
  let start = flow.start;
  if (id === flow.start) {
    if (!after) return { ok: false, error: "No puedes quitar el primer paso si no hay otro después de él." };
    start = after;
  }
  return { ok: true, flow: pruneUnreachable({ start, steps }) };
}

/** Replaces a step with an edited copy of itself. Arrows that no longer exist (a deleted button) are cleaned up by the prune. */
export function updateStep(flow: Flow, step: Step): EditResult {
  if (!flow.steps[step.id]) return { ok: false, error: "Ese paso ya no existe." };
  return { ok: true, flow: pruneUnreachable({ start: flow.start, steps: { ...flow.steps, [step.id]: step } }) };
}

// ---- Laying the flow out ----

export type TreeNode = {
  step: Step;
  slots: { slot: Slot; child: TreeNode | { ref: string } | null }[];
};

/** The flow as a tree from its first step. A step that two paths lead to is drawn once; the second path shows a reference to it. */
export function buildTree(flow: Flow): TreeNode | null {
  const seen = new Set<string>();
  const walk = (id: string): TreeNode | { ref: string } => {
    if (seen.has(id)) return { ref: id };
    seen.add(id);
    const step = flow.steps[id];
    return { step, slots: slotsOf(step).map((slot) => ({ slot, child: slot.target && flow.steps[slot.target] ? walk(slot.target) : null })) };
  };
  if (!flow.steps[flow.start]) return null;
  return walk(flow.start) as TreeNode;
}

/** A short name for a step in a list of references ("Mensaje: Hola Ana…"). */
export function stepTitle(step: Step): string {
  const clip = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);
  switch (step.type) {
    case "message":
      return `Mensaje: ${clip(step.text)}`;
    case "list":
      return `Lista: ${clip(step.text)}`;
    case "reaction":
      return `Reacción ${step.emoji}`;
    case "comment":
      return `Comentario: ${clip(step.text)}`;
    case "internal":
      return `Aviso al equipo: ${clip(step.text)}`;
    case "ai_condition":
      return `Condición de IA: ${clip(step.question)}`;
    case "pause":
      return `Pausa de ${step.amount} ${step.unit === "minutes" ? "min" : step.unit === "hours" ? "h" : "días"}`;
    case "actions":
      return "Acciones";
    case "condition":
      return "Condición";
    case "validation":
      return `Validación: ${clip(step.prompt)}`;
    case "goto":
      return "Ir a otro paso";
    case "start_flow":
      return "Iniciar otro flujo";
    case "http":
      return "Enviar a una URL";
    case "round_robin":
      return "Round Robin";
    case "stop":
      return "Parar flujo";
  }
}

// ---- Triggers ----

export function defaultTrigger(type: Trigger["type"], firstStageId = ""): Trigger {
  switch (type) {
    case "new_conversation":
      return { type };
    case "message":
      return { type, keywords: ["precio"], match: "contains" };
    case "stage_changed":
      return { type, stageId: firstStageId };
    case "tag_added":
      return { type, tag: "Interesado" };
    case "appointment_booked":
      return { type };
  }
}

export const TRIGGER_LABELS: Record<Trigger["type"], string> = {
  new_conversation: "Llega un chat nuevo",
  message: "El cliente escribe una palabra",
  stage_changed: "El lead cambia de etapa",
  tag_added: "Se pone una etiqueta",
  appointment_booked: "Se agenda una cita",
};

/** A trigger as a short sentence, for the list of flows. */
export function triggerSummary(trigger: Trigger, stageName: (id: string) => string | null): string {
  switch (trigger.type) {
    case "new_conversation":
      return "Chat nuevo";
    case "message":
      return `Escribe «${trigger.keywords.slice(0, 2).join("», «")}»${trigger.keywords.length > 2 ? "…" : ""}`;
    case "stage_changed":
      return `Pasa a «${stageName(trigger.stageId) ?? "una etapa"}»`;
    case "tag_added":
      return `Etiqueta «${trigger.tag}»`;
    case "appointment_booked":
      return "Cita agendada";
  }
}
