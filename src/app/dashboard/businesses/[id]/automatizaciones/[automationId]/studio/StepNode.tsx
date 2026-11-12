"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Step } from "@/lib/automations/flow";
import { slotsOf } from "@/lib/automations/flowEdit";
import { NODE_WIDTH } from "@/lib/automations/flowLayout";
import { StepIcon } from "../../StepIcon";
import { STEP_META } from "../../stepMeta";

// One card of the flow on the canvas: the step's number and kind, a short
// summary and, on its right edge, one dot per way out (a button, "otra
// respuesta", "siguiente"…). Drag from a dot to another card to connect them.

export type StepNodeData = {
  step: Step;
  number: number;
  issues: string[];
  /** Nothing leads here, so the step never runs. */
  loose: boolean;
  readOnly: boolean;
  /** Opens the menu of steps for the way out `slotKey`, at that point of the screen. */
  onAdd: (slotKey: string, x: number, y: number) => void;
};
export type StepFlowNode = Node<StepNodeData, "step">;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

/** What a card shows under its title. */
export function stepSummary(step: Step): string {
  switch (step.type) {
    case "message":
    case "list":
    case "comment":
    case "internal":
      return clip(step.text, 140);
    case "reaction":
      return step.emoji;
    case "ai_condition":
      return clip(step.question, 140);
    case "validation":
      return clip(step.prompt, 140);
    case "pause":
      return `Espera ${step.amount} ${step.unit === "minutes" ? "min" : step.unit === "hours" ? "h" : step.amount === 1 ? "día" : "días"}`;
    case "actions":
      return `${step.actions.length} ${step.actions.length === 1 ? "acción" : "acciones"}`;
    case "condition":
      return `${step.rules.length} ${step.rules.length === 1 ? "regla" : "reglas"} (${step.match === "all" ? "todas" : "alguna"})`;
    case "http":
      return clip(step.url, 60);
    case "round_robin":
      return `Reparte entre ${step.pipelineIds.length} embudos`;
    case "goto":
      return "Salta a otro paso";
    case "start_flow":
      return "Pasa a otro flujo";
    case "stop":
      return "Aquí termina el flujo";
  }
}

const DOT = { width: 14, height: 14, background: "var(--ink-muted)", border: "2px solid var(--surface)" } as const;

export function StepNode({ data, selected }: NodeProps<StepFlowNode>) {
  const { step, number, issues, loose, readOnly, onAdd } = data;
  const slots = slotsOf(step);
  const meta = STEP_META[step.type];

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`relative rounded-2xl border bg-surface shadow-sm transition-shadow ${selected ? "border-accent shadow-lg ring-2 ring-accent/40" : "border-border-strong"}`}
    >
      <Handle type="target" position={Position.Left} id="in" style={{ ...DOT, top: 26 }} />
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="fl-mono flex h-6 min-w-6 flex-none items-center justify-center rounded-md border border-border px-1 text-xs font-semibold text-ink-muted">{number}</span>
        <StepIcon type={step.type} size={26} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{meta.label}</span>
        {issues.length > 0 && (
          <span title={issues.join("\n")} className="flex-none rounded-full bg-[#fab219]/20 px-1.5 text-xs font-bold text-[#b97800]" aria-label="Este paso necesita que lo completes">
            ⚠
          </span>
        )}
      </div>
      <p className="px-3 pb-2 pt-2 text-xs leading-relaxed text-ink-muted [overflow-wrap:anywhere]">{stepSummary(step)}</p>
      {loose && <p className="mx-3 mb-2 rounded-md bg-[#fab219]/15 px-2 py-1 text-[11px] font-medium text-[#b97800]">Suelto: nada lleva aquí, no se ejecuta.</p>}

      {step.type === "goto" && (
        <div className="relative flex h-7 items-center justify-end px-3 text-xs text-ink-muted">
          Saltar
          <Handle type="source" position={Position.Right} id="jump" style={{ ...DOT, background: "var(--accent)" }} />
        </div>
      )}
      {slots.length > 0 && (
        <ul className="space-y-0.5 pb-2">
          {slots.map((slot) => (
            <li key={slot.key} className="relative flex h-7 items-center justify-end gap-2 pl-3 pr-3 text-xs text-ink-muted">
              <span className="min-w-0 flex-1 truncate text-right">{slot.label}</span>
              {!slot.target && !readOnly && (
                <button
                  type="button"
                  className="nodrag nopan flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border-strong text-sm leading-none text-ink-muted transition hover:border-accent hover:text-accent"
                  aria-label={`Agregar un paso en «${slot.label}»`}
                  onClick={(e) => onAdd(slot.key, e.clientX, e.clientY)}
                >
                  +
                </button>
              )}
              <Handle type="source" position={Position.Right} id={slot.key} style={{ ...DOT, background: slot.target ? "var(--accent)" : "var(--ink-muted)" }} />
            </li>
          ))}
        </ul>
      )}
      {slots.length === 0 && step.type !== "goto" && <div className="h-2" />}
    </div>
  );
}
