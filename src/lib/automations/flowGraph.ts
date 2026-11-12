import type { Flow, Position, StepType } from "./flow";
import { TERMINAL_TYPES, continuationKey, defaultStep, newStepId, slotsOf, withSlot, type EditContext, type EditResult } from "./flowEdit";

// What the free canvas does to a flow: draw an arrow between two cards, take
// one away, drop a new card anywhere, change where the flow starts. Unlike the
// tree editor, nothing here deletes a card because it became unreachable.

/** Points the arrow `key` of `stepId` at `target`. */
export function connectSlot(flow: Flow, stepId: string, key: string, target: string): EditResult {
  const step = flow.steps[stepId];
  if (!step || !flow.steps[target]) return { ok: false, error: "Ese paso ya no existe." };
  if (stepId === target) return { ok: false, error: "Un paso no puede llevar a sí mismo." };
  if (!slotsOf(step).some((s) => s.key === key)) return { ok: false, error: "Ese lugar ya no existe." };
  return { ok: true, flow: { ...flow, steps: { ...flow.steps, [stepId]: withSlot(step, key, target) } } };
}

/** Takes the arrow `key` of `stepId` away. */
export function disconnectSlot(flow: Flow, stepId: string, key: string): EditResult {
  const step = flow.steps[stepId];
  if (!step) return { ok: false, error: "Ese paso ya no existe." };
  if (!slotsOf(step).some((s) => s.key === key)) return { ok: false, error: "Ese lugar ya no existe." };
  return { ok: true, flow: { ...flow, steps: { ...flow.steps, [stepId]: withSlot(step, key, null) } } };
}

/** Where the flow begins. */
export function setStart(flow: Flow, stepId: string): EditResult {
  if (!flow.steps[stepId]) return { ok: false, error: "Ese paso ya no existe." };
  return { ok: true, flow: { ...flow, start: stepId } };
}

/** A new, unconnected card at `position`. */
export function addFloatingStep(flow: Flow, type: StepType, position: Position, ctx: EditContext = {}): EditResult {
  const id = newStepId(flow, type);
  const step = defaultStep(type, id, flow, ctx);
  return {
    ok: true,
    flow: { ...flow, steps: { ...flow.steps, [id]: step }, layout: { ...(flow.layout ?? {}), [id]: { x: Math.round(position.x), y: Math.round(position.y) } } },
    id,
  };
}

/** A new step in front of the first one: it becomes the start and leads to what started the flow before. */
export function addBeforeStart(flow: Flow, type: StepType, ctx: EditContext = {}): EditResult {
  const id = newStepId(flow, type);
  const step = defaultStep(type, id, flow, ctx);
  const carry = continuationKey(step);
  if (!carry) return { ok: false, error: "Este paso termina el flujo: no puede ir al principio." };
  return { ok: true, flow: { ...flow, start: id, steps: { ...flow.steps, [id]: withSlot(step, carry, flow.start) } }, id };
}

/** Whether an arrow can leave a card of this kind. */
export const canLeave = (type: StepType) => !TERMINAL_TYPES.includes(type);

/** A new position for a card that was moved. */
export function moveStep(flow: Flow, stepId: string, position: Position): Flow {
  if (!flow.steps[stepId]) return flow;
  return { ...flow, layout: { ...(flow.layout ?? {}), [stepId]: { x: Math.round(position.x), y: Math.round(position.y) } } };
}

/** The steps nothing leads to (they never run), other than the first one. */
export function looseSteps(flow: Flow): string[] {
  const seen = new Set<string>();
  const queue = [flow.start];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id) || !flow.steps[id]) continue;
    seen.add(id);
    const step = flow.steps[id];
    for (const slot of slotsOf(step)) if (slot.target) queue.push(slot.target);
    if (step.type === "goto") queue.push(step.target);
  }
  return Object.keys(flow.steps).filter((id) => !seen.has(id));
}
