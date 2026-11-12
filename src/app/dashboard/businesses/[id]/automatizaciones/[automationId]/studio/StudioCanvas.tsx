"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
} from "@xyflow/react";
import { askConfirm } from "@/components/ConfirmHost";
import type { Flow, StepType } from "@/lib/automations/flow";
import { addStep, removeStep, slotsOf, updateStep } from "@/lib/automations/flowEdit";
import { addBeforeStart, addFloatingStep, connectSlot, disconnectSlot, looseSteps, moveStep, setStart } from "@/lib/automations/flowGraph";
import { COLUMN_GAP, NODE_WIDTH, estimateHeight, placeNewStep, relayout, stepNumbers } from "@/lib/automations/flowLayout";
import type { EditorData } from "../StepForm";
import { StepNode, type StepFlowNode } from "./StepNode";
import { StepPicker } from "./StepPicker";
import { TRIGGER_WIDTH, TriggerNode, type TriggerFlowNode } from "./TriggerNode";

// The flow as a canvas, from left to right. Cards can be dragged anywhere and
// the arrows follow them. Drag from a card's dot to another card to connect
// them, or let go on an empty spot to add a step there; drag the end of an
// arrow to another card to reconnect it. Every change goes out as a new flow.

type StudioNode = StepFlowNode | TriggerFlowNode;

const nodeTypes: NodeTypes = { step: StepNode, trigger: TriggerNode };

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 640px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

type Props = {
  flow: Flow;
  triggerSummaries: string[];
  issues: Record<string, string[]>;
  /** A step id, "trigger" or null. */
  selectedId: string | null;
  readOnly: boolean;
  data: EditorData;
  canUndo: boolean;
  canRedo: boolean;
  /** Width of the panel that covers the right edge, so the tools stay beside it instead of under it. */
  rightInset: number;
  onSelect: (id: string | null) => void;
  onChange: (flow: Flow) => void;
  onError: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
};

type PickerState = { x: number; y: number } & ({ kind: "slot"; parentId: string; key: string; dropped: boolean } | { kind: "floating" });

const EDGE_STYLE = { stroke: "var(--ink-muted)", strokeWidth: 2 } as const;
const arrow = { type: MarkerType.ArrowClosed, color: "var(--ink-muted)" } as const;

const parseEdgeId = (id: string): [string, string] => {
  const cut = id.indexOf("|");
  return [id.slice(0, cut), id.slice(cut + 1)];
};

function buildEdges(flow: Flow, previous: Edge[]): Edge[] {
  const selected = new Set(previous.filter((e) => e.selected).map((e) => e.id));
  const edges: Edge[] = [
    { id: "trigger", source: "trigger", sourceHandle: "trigger", target: flow.start, targetHandle: "in", style: EDGE_STYLE, markerEnd: arrow, reconnectable: "target", deletable: false, selected: selected.has("trigger") },
  ];
  for (const step of Object.values(flow.steps)) {
    for (const slot of slotsOf(step)) {
      if (!slot.target || !flow.steps[slot.target]) continue;
      const id = `${step.id}|${slot.key}`;
      edges.push({ id, source: step.id, sourceHandle: slot.key, target: slot.target, targetHandle: "in", style: EDGE_STYLE, markerEnd: arrow, reconnectable: "target", selected: selected.has(id) });
    }
    if (step.type === "goto" && flow.steps[step.target]) {
      const id = `${step.id}|jump`;
      edges.push({ id, source: step.id, sourceHandle: "jump", target: step.target, targetHandle: "in", style: { ...EDGE_STYLE, strokeDasharray: "6 5" }, markerEnd: arrow, reconnectable: false, deletable: false, selected: selected.has(id) });
    }
  }
  return edges;
}

function Canvas({ flow, triggerSummaries, issues, selectedId, readOnly, data, canUndo, canRedo, rightInset, onSelect, onChange, onError, onUndo, onRedo }: Props) {
  const { fitView, zoomIn, zoomOut, getNodes, screenToFlowPosition } = useReactFlow<StudioNode>();
  // The map and the hint take too much of a phone's screen.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [reconnected, setReconnected] = useState(false);

  const build = (previous: StudioNode[]): StudioNode[] => {
    const before = new Map(previous.map((n) => [n.id, n]));
    const loose = new Set(looseSteps(flow));
    const start = flow.layout?.[flow.start] ?? { x: 0, y: 0 };
    const oldTrigger = before.get("trigger") as TriggerFlowNode | undefined;
    const trigger: TriggerFlowNode = {
      id: "trigger",
      type: "trigger",
      position: oldTrigger && oldTrigger.data.startId === flow.start ? oldTrigger.position : { x: start.x - TRIGGER_WIDTH - 90, y: start.y },
      data: { summaries: triggerSummaries, readOnly, startId: flow.start },
      selected: selectedId === "trigger",
      deletable: false,
      ...(oldTrigger?.measured ? { measured: oldTrigger.measured } : {}),
    };
    const numbers = stepNumbers(flow);
    const steps: StepFlowNode[] = Object.keys(flow.steps).map((id) => {
      const old = before.get(id);
      return {
        id,
        type: "step",
        // A card being dragged keeps the position the drag gives it.
        position: old?.dragging ? old.position : (flow.layout?.[id] ?? old?.position ?? { x: 0, y: 0 }),
        data: {
          step: flow.steps[id],
          number: numbers[id],
          issues: issues[id] ?? [],
          loose: loose.has(id),
          readOnly,
          onAdd: (key: string, x: number, y: number) => setPicker({ kind: "slot", parentId: id, key, x, y, dropped: false }),
        },
        selected: selectedId === id,
        ...(old?.measured ? { measured: old.measured } : {}),
      };
    });
    return [trigger, ...steps];
  };

  const [nodes, setNodes] = useState<StudioNode[]>(() => build([]));
  const [edges, setEdges] = useState<Edge[]>(() => buildEdges(flow, []));
  // Whatever the editor changes (the flow, the issues, the selection) is
  // reflected on the cards, keeping what the canvas itself knows (sizes, drags).
  const [inputs, setInputs] = useState({ flow, issues, triggerSummaries, selectedId, readOnly });
  if (inputs.flow !== flow || inputs.issues !== issues || inputs.triggerSummaries !== triggerSummaries || inputs.selectedId !== selectedId || inputs.readOnly !== readOnly) {
    setInputs({ flow, issues, triggerSummaries, selectedId, readOnly });
    setNodes(build(nodes));
    if (inputs.flow !== flow) setEdges(buildEdges(flow, edges));
  }

  const apply = (result: { ok: true; flow: Flow; id?: string } | { ok: false; error: string }) => {
    if (!result.ok) {
      onError(result.error);
      return null;
    }
    onChange(result.flow);
    return result;
  };

  function connect(source: string, handle: string | null, target: string) {
    if (readOnly || !handle) return;
    if (source === "trigger") return void apply(setStart(flow, target));
    const step = flow.steps[source];
    if (step?.type === "goto" && handle === "jump") return void apply(updateStep(flow, { ...step, target }, { prune: false }));
    apply(connectSlot(flow, source, handle, target));
  }

  const onNodesChange = (changes: NodeChange<StudioNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns.map((n) => n)));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es));

  const onConnect = (c: Connection) => connect(c.source, c.sourceHandle, c.target);

  const onConnectEnd: OnConnectEnd = (event, state) => {
    if (readOnly || state.isValid || state.toNode || !state.fromNode || !state.fromHandle) return;
    const handle = state.fromHandle.id;
    if (!handle || handle === "jump") return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    setPicker({ kind: "slot", parentId: state.fromNode.id, key: handle, x: point.clientX, y: point.clientY, dropped: true });
  };

  function pick(type: StepType) {
    const p = picker;
    setPicker(null);
    if (!p) return;
    const ctx = { otherAutomationId: data.automations[0]?.id };
    const at = screenToFlowPosition({ x: p.x, y: p.y });
    if (p.kind === "floating") {
      const added = apply(addFloatingStep(flow, type, { x: at.x - NODE_WIDTH / 2, y: at.y - 40 }, ctx));
      if (added?.id) onSelect(added.id);
      return;
    }
    const added = apply(p.parentId === "trigger" ? addBeforeStart(flow, type, ctx) : addStep(flow, p.parentId, p.key, type, ctx));
    if (!added?.id) return;
    // Where it was dropped, or next to the step it came from.
    let next = added.flow;
    if (p.parentId === "trigger") {
      const start = flow.layout?.[flow.start] ?? { x: 0, y: 0 };
      next = { ...next, layout: { ...(next.layout ?? {}), [added.id]: { x: Math.round(start.x - NODE_WIDTH - COLUMN_GAP), y: Math.round(start.y) } } };
    } else if (p.dropped) {
      next = { ...next, layout: { ...(next.layout ?? {}), [added.id]: { x: Math.round(at.x), y: Math.round(at.y - 24) } } };
    } else {
      next = placeNewStep(next, added.id, p.parentId, (id) => getNodes().find((n) => n.id === id)?.measured?.height ?? (next.steps[id] ? estimateHeight(next.steps[id]) : 160));
    }
    onChange(next);
    onSelect(added.id);
  }

  async function beforeDelete({ nodes: gone, edges: cut }: { nodes: StudioNode[]; edges: Edge[] }) {
    if (readOnly) return false;
    let next = flow;
    let error = "";
    for (const n of gone) {
      if (n.type !== "step") continue;
      const step = next.steps[n.id];
      if (!step) continue;
      const branches = slotsOf(step).filter((s) => s.target).length;
      const needsAsk = branches > 1 || step.type === "list" || (step.type === "message" && !!step.buttons?.length);
      if (needsAsk && !(await askConfirm({ title: "Quitar este paso", message: "Las flechas que salen de este paso se quitan con él. ¿Seguro?", confirmLabel: "Quitar", tone: "danger" }))) continue;
      const res = removeStep(next, n.id, { prune: false });
      if (res.ok) next = res.flow;
      else error = res.error;
    }
    for (const e of cut) {
      const [source, key] = parseEdgeId(e.id);
      if (e.id === "trigger" || key === "jump" || !next.steps[source]) continue;
      const res = disconnectSlot(next, source, key);
      if (res.ok) next = res.flow;
    }
    if (next !== flow) onChange(next);
    if (error) onError(error);
    // The flow state is the source of truth: the canvas follows it instead of deleting by itself.
    return false;
  }

  function arrange() {
    const next = relayout(flow, (id) => getNodes().find((n) => n.id === id)?.measured?.height ?? (flow.steps[id] ? estimateHeight(flow.steps[id]) : 160));
    onChange(next);
    // The cards move on the next render; frame them once they have.
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 250 }), 60);
  }

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, unless a field is being typed in.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onUndo, onRedo]);

  const tool = "flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-border disabled:hover:text-ink";

  return (
    <>
      <ReactFlow<StudioNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onNodeDragStop={(_, __, dragged) => {
          if (readOnly) return;
          let next = flow;
          for (const n of dragged) if (n.type === "step") next = moveStep(next, n.id, n.position);
          if (next !== flow) onChange(next);
        }}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={(c) => c.source !== c.target && c.target !== "trigger"}
        onReconnectStart={() => setReconnected(false)}
        onReconnect={(old, c) => {
          setReconnected(true);
          connect(old.source, old.sourceHandle ?? null, c.target);
        }}
        onReconnectEnd={(_, edge, __, state) => {
          // Letting go of an arrow's end in an empty spot takes the arrow away.
          if (readOnly || reconnected || state.isValid || edge.id === "trigger") return;
          const [source, key] = parseEdgeId(edge.id);
          if (key !== "jump") apply(disconnectSlot(flow, source, key));
        }}
        onBeforeDelete={beforeDelete}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesReconnectable={!readOnly}
        connectionRadius={36}
        reconnectRadius={24}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        minZoom={0.15}
        maxZoom={1.6}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        zoomOnDoubleClick={false}
        className="fl-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
        {wide && <MiniMap pannable zoomable ariaLabel="Mapa del flujo" nodeColor={(n) => (n.type === "trigger" ? "#16a34a" : "#3b82f6")} maskColor="rgba(0,0,0,0.25)" style={{ marginRight: 15 + rightInset }} />}
        <Panel position="top-right" className="flex flex-wrap items-center justify-end gap-2" style={{ marginRight: 15 + rightInset }}>
          {!readOnly && (
            <>
              <button type="button" className={tool} onClick={onUndo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
                ↶
              </button>
              <button type="button" className={tool} onClick={onRedo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Mayús+Ctrl+Z)">
                ↷
              </button>
            </>
          )}
          <button type="button" className={tool} onClick={() => fitView({ padding: 0.2, maxZoom: 1, duration: 250 })} aria-label="Ver todo el flujo" title="Ver todo el flujo">
            ⤢
          </button>
          <button type="button" className={tool} onClick={() => zoomOut({ duration: 150 })} aria-label="Alejar" title="Alejar">
            −
          </button>
          <button type="button" className={tool} onClick={() => zoomIn({ duration: 150 })} aria-label="Acercar" title="Acercar">
            +
          </button>
          {!readOnly && (
            <>
              <button type="button" className={tool} onClick={arrange} title="Ordena las tarjetas de izquierda a derecha">
                ✨<span className="ml-1 hidden sm:inline">Ordenar</span>
              </button>
              <button
                type="button"
                className={`${tool} border-accent bg-accent text-accent-ink hover:text-accent-ink`}
                onClick={() => setPicker({ kind: "floating", x: window.innerWidth / 2, y: window.innerHeight / 2 })}
              >
                + Paso
              </button>
            </>
          )}
        </Panel>
        {!readOnly && wide && (
          <Panel position="bottom-left" className="max-w-xs rounded-xl border border-border bg-surface/90 px-3 py-2 text-xs leading-relaxed text-ink-muted shadow-sm">
            Arrastra desde un punto de la tarjeta a otra para conectarlas. Si la sueltas en un espacio vacío, agregas un paso ahí.
          </Panel>
        )}
      </ReactFlow>
      {picker && <StepPicker x={picker.x} y={picker.y} onPick={pick} onClose={() => setPicker(null)} />}
    </>
  );
}

export function StudioCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
