import type { Flow, Position, Step } from "./flow";
import { slotsOf } from "./flowEdit";

// Where each step's card sits on the canvas, from left to right. Plain
// functions on the flow, no React: the editor asks for positions and draws
// them, and every rule here is tested on its own.

export const NODE_WIDTH = 300;
export const COLUMN_GAP = 140;
export const ROW_GAP = 36;

export type HeightOf = (id: string) => number;

/** A rough height for a step's card, before the browser has measured the real one. */
export function estimateHeight(step: Step): number {
  const outputs = slotsOf(step).length;
  const textLength = "text" in step ? step.text.length : "question" in step ? step.question.length : "prompt" in step ? step.prompt.length : 0;
  const lines = Math.max(1, Math.min(5, Math.ceil(textLength / 34)));
  return 64 + lines * 18 + outputs * 28;
}

/** The steps a step leads to, in the order its arrows are drawn (buttons first, "after" last), then a jump's target. */
function childrenOf(flow: Flow, id: string): string[] {
  const step = flow.steps[id];
  const targets = [...slotsOf(step).map((s) => s.target), ...(step.type === "goto" ? [step.target] : [])];
  return [...new Set(targets)].filter((c): c is string => !!c && !!flow.steps[c] && c !== id);
}

/**
 * The number on each card: the first step is 1 and the rest follow in the order
 * the flow reaches them, level by level. Steps nothing leads to come last.
 * (It follows the flow, not where the cards were dragged to.)
 */
export function stepNumbers(flow: Flow): Record<string, number> {
  const numbers: Record<string, number> = {};
  const queue = [flow.start];
  let count = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (!flow.steps[id] || numbers[id]) continue;
    numbers[id] = ++count;
    for (const child of childrenOf(flow, id)) if (!numbers[child]) queue.push(child);
  }
  for (const id of Object.keys(flow.steps)) if (!numbers[id]) numbers[id] = ++count;
  return numbers;
}

/**
 * Lays the flow out in columns: a step sits one column to the right of the
 * latest step that leads to it, so every arrow goes forward. Steps in the same
 * column are stacked, each near the middle of what leads to it. A jump back
 * (an arrow that would close a loop) is ignored when counting columns. Steps
 * nothing leads to go under the others in the first column.
 */
export function autoLayout(flow: Flow, heightOf?: HeightOf): Record<string, Position> {
  const height: HeightOf = heightOf ?? ((id) => estimateHeight(flow.steps[id]));
  const children = (id: string) => childrenOf(flow, id);

  // Depth-first from the start (then from any step nothing reaches): finishing
  // order gives a topological order once the loop-closing arrows are set aside.
  const state = new Map<string, 1 | 2>();
  const finished: string[] = [];
  const back = new Set<string>();
  const discovered = new Map<string, number>();
  const visit = (id: string) => {
    state.set(id, 1);
    discovered.set(id, discovered.size);
    for (const c of children(id)) {
      if (state.get(c) === 1) back.add(`${id}>${c}`);
      else if (!state.has(c)) visit(c);
    }
    state.set(id, 2);
    finished.push(id);
  };
  const roots = [flow.start, ...Object.keys(flow.steps).filter((id) => id !== flow.start)];
  for (const root of roots) {
    if (!flow.steps[root] || state.has(root)) continue;
    visit(root);
  }
  const topological = [...finished].reverse();
  // Ties between steps in a column are settled by where the arrows were drawn.
  const index = discovered;

  const depth = new Map<string, number>();
  const parents = new Map<string, string[]>();
  for (const id of topological) {
    if (!depth.has(id)) depth.set(id, 0);
    for (const c of children(id)) {
      if (back.has(`${id}>${c}`)) continue;
      depth.set(c, Math.max(depth.get(c) ?? 0, (depth.get(id) ?? 0) + 1));
      parents.set(c, [...(parents.get(c) ?? []), id]);
    }
  }

  const columns = new Map<number, string[]>();
  for (const id of topological) columns.set(depth.get(id) ?? 0, [...(columns.get(depth.get(id) ?? 0) ?? []), id]);

  const layout: Record<string, Position> = {};
  const center = (id: string) => layout[id].y + height(id) / 2;
  for (const d of [...columns.keys()].sort((a, b) => a - b)) {
    const ids = columns.get(d) as string[];
    const wanted = (id: string): number | null => {
      const placed = (parents.get(id) ?? []).filter((p) => layout[p]);
      return placed.length ? placed.reduce((sum, p) => sum + center(p), 0) / placed.length : null;
    };
    const ordered = [...ids].sort((a, b) => {
      const wa = wanted(a);
      const wb = wanted(b);
      if (wa === null && wb === null) return (index.get(a) ?? 0) - (index.get(b) ?? 0);
      if (wa === null) return 1;
      if (wb === null) return -1;
      return wa - wb || (index.get(a) ?? 0) - (index.get(b) ?? 0);
    });
    let cursor = 0;
    for (const id of ordered) {
      const w = wanted(id);
      const top = w === null ? cursor : Math.max(cursor, w - height(id) / 2);
      layout[id] = { x: d * (NODE_WIDTH + COLUMN_GAP), y: Math.round(top) };
      cursor = top + height(id) + ROW_GAP;
    }
  }
  return layout;
}

/** The flow with a position for every step: the ones it has are kept, the missing ones are laid out. */
export function ensureLayout(flow: Flow, heightOf?: HeightOf): Flow {
  const have = flow.layout ?? {};
  if (Object.keys(flow.steps).every((id) => have[id])) return flow;
  const auto = autoLayout(flow, heightOf);
  const layout: Record<string, Position> = {};
  for (const id of Object.keys(flow.steps)) layout[id] = have[id] ?? auto[id];
  return { ...flow, layout };
}

/** The flow laid out again from scratch (the "Ordenar" button). */
export function relayout(flow: Flow, heightOf?: HeightOf): Flow {
  return { ...flow, layout: autoLayout(flow, heightOf) };
}

/** A spot for a step just added after `parentId`: to its right, at the first height nothing else occupies. */
export function placeNewStep(flow: Flow, id: string, parentId: string, heightOf?: HeightOf): Flow {
  const height: HeightOf = heightOf ?? ((s) => (flow.steps[s] ? estimateHeight(flow.steps[s]) : 160));
  const layout = { ...(flow.layout ?? {}) };
  const parent = layout[parentId] ?? { x: 0, y: 0 };
  const x = parent.x + NODE_WIDTH + COLUMN_GAP;
  const mine = height(id);
  const taken = Object.entries(layout)
    .filter(([other]) => other !== id)
    .filter(([, p]) => Math.abs(p.x - x) < NODE_WIDTH)
    .map(([other, p]) => ({ top: p.y, bottom: p.y + height(other) }))
    .sort((a, b) => a.top - b.top);
  let y = parent.y;
  for (const box of taken) {
    if (y + mine + ROW_GAP <= box.top) break;
    if (y < box.bottom + ROW_GAP) y = box.bottom + ROW_GAP;
  }
  layout[id] = { x: Math.round(x), y: Math.round(y) };
  return { ...flow, layout };
}

/** The flow without positions for steps that no longer exist. */
export function trimLayout(flow: Flow): Flow {
  if (!flow.layout) return flow;
  return { ...flow, layout: Object.fromEntries(Object.entries(flow.layout).filter(([id]) => flow.steps[id])) };
}
