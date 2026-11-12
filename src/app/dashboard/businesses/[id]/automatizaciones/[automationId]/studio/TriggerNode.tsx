"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

// The first card, at the left: what makes the flow start. Clicking it opens the
// list of triggers; its dot leads to the first step.

export type TriggerNodeData = {
  summaries: string[];
  readOnly: boolean;
  /** The step the flow starts at: the card is placed again when it changes. */
  startId: string;
};
export type TriggerFlowNode = Node<TriggerNodeData, "trigger">;

export const TRIGGER_WIDTH = 230;

export function TriggerNode({ data, selected }: NodeProps<TriggerFlowNode>) {
  const shown = data.summaries.slice(0, 3);
  const more = data.summaries.length - shown.length;
  return (
    <div
      style={{ width: TRIGGER_WIDTH }}
      className={`relative cursor-pointer rounded-2xl border bg-surface p-3 shadow-sm ${selected ? "border-accent ring-2 ring-accent/40" : "border-[#16a34a]/60"}`}
    >
      <p className="text-sm font-semibold text-[#16a34a]">⚡ Disparadores</p>
      {shown.length === 0 ? (
        <p className="mt-1 text-xs text-[#b97800]">Falta uno: toca aquí para agregarlo.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {shown.map((s, i) => (
            <li key={i} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-muted [overflow-wrap:anywhere]">
              {s}
            </li>
          ))}
          {more > 0 && <li className="px-2 text-xs text-ink-faint">y {more} más</li>}
        </ul>
      )}
      <Handle type="source" position={Position.Right} id="trigger" style={{ width: 14, height: 14, background: "var(--accent)", border: "2px solid var(--surface)", top: 24 }} />
    </div>
  );
}
