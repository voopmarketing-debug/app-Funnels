import { describe, expect, it } from "vitest";
import { checkFlow, type Flow } from "./flow";
import { addStep, removeStep } from "./flowEdit";
import { COLUMN_GAP, NODE_WIDTH, ROW_GAP, autoLayout, ensureLayout, estimateHeight, placeNewStep, relayout, stepNumbers, trimLayout } from "./flowLayout";

const H = () => 120;

// start ─┬─ button a ─▶ a ─┐
//        ├─ button b ─▶ b ─┼─▶ end
//        └─ next ─────▶ c ─┘
const branching: Flow = {
  start: "start",
  steps: {
    start: {
      id: "start",
      type: "message",
      text: "Hola",
      buttons: [
        { id: "a", title: "A", next: "a" },
        { id: "b", title: "B", next: "b" },
      ],
      next: "c",
    },
    a: { id: "a", type: "message", text: "A", next: "end" },
    b: { id: "b", type: "message", text: "B", next: "end" },
    c: { id: "c", type: "message", text: "C", next: "end" },
    end: { id: "end", type: "stop" },
  },
};

describe("autoLayout", () => {
  it("puts every step one column to the right of what leads to it", () => {
    const l = autoLayout(branching, H);
    const col = NODE_WIDTH + COLUMN_GAP;
    expect(l.start.x).toBe(0);
    expect(l.a.x).toBe(col);
    expect(l.b.x).toBe(col);
    expect(l.c.x).toBe(col);
    expect(l.end.x).toBe(2 * col);
  });

  it("stacks steps of the same column without overlapping", () => {
    const l = autoLayout(branching, H);
    const ys = ["a", "b", "c"].map((id) => l[id].y).sort((p, q) => p - q);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(120 + ROW_GAP);
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(120 + ROW_GAP);
  });

  it("keeps the branches in the order of the arrows and a merge between them", () => {
    const l = autoLayout(branching, H);
    expect(l.a.y).toBeLessThan(l.b.y);
    expect(l.b.y).toBeLessThan(l.c.y);
    // The step they all lead to sits around the middle of them.
    expect(l.end.y).toBeGreaterThan(l.a.y - 1);
    expect(l.end.y).toBeLessThan(l.c.y + 120);
  });

  it("uses the longest path, so every arrow goes forward", () => {
    const flow: Flow = {
      start: "one",
      steps: {
        one: { id: "one", type: "message", text: "1", next: "two" },
        two: { id: "two", type: "message", text: "2", next: "three" },
        three: { id: "three", type: "stop" },
      },
    };
    // A shortcut from the first step straight to the last must not pull it back.
    flow.steps.one = { id: "one", type: "condition", match: "all", rules: [{ field: "email", op: "exists" }], yes: "two", no: "three" };
    const l = autoLayout(flow, H);
    expect(l.three.x).toBeGreaterThan(l.two.x);
  });

  it("copes with a jump back (a loop) without looping forever", () => {
    const flow: Flow = {
      start: "ask",
      steps: {
        ask: { id: "ask", type: "message", text: "¿Sí?", next: "again" },
        again: { id: "again", type: "goto", target: "ask" },
      },
    };
    const l = autoLayout(flow, H);
    expect(l.again.x).toBeGreaterThan(l.ask.x);
  });

  it("puts steps nothing leads to under the rest, in the first column", () => {
    const flow: Flow = {
      start: "a",
      steps: { a: { id: "a", type: "message", text: "A" }, lost: { id: "lost", type: "message", text: "?" } },
    };
    const l = autoLayout(flow, H);
    expect(l.lost.x).toBe(0);
    expect(l.lost.y).toBeGreaterThan(l.a.y);
  });

  it("gives the same layout every time", () => {
    expect(autoLayout(branching, H)).toEqual(autoLayout(branching, H));
  });

  it("estimates taller cards for longer texts and more outputs", () => {
    const short = estimateHeight({ id: "m", type: "message", text: "Hola" });
    const long = estimateHeight({ id: "m", type: "message", text: "x".repeat(300), buttons: [{ id: "b", title: "B" }] });
    expect(long).toBeGreaterThan(short);
  });
});

describe("ensureLayout / relayout / trimLayout", () => {
  it("keeps the positions a flow already has and only places the missing ones", () => {
    const flow: Flow = { ...branching, layout: { start: { x: 500, y: 500 } } };
    const out = ensureLayout(flow, H);
    expect(out.layout?.start).toEqual({ x: 500, y: 500 });
    expect(Object.keys(out.layout ?? {}).sort()).toEqual(Object.keys(branching.steps).sort());
  });

  it("returns the same flow when everything is placed", () => {
    const placed = ensureLayout(branching, H);
    expect(ensureLayout(placed, H)).toBe(placed);
  });

  it("relayout replaces every position", () => {
    const moved: Flow = { ...ensureLayout(branching, H), layout: Object.fromEntries(Object.keys(branching.steps).map((id) => [id, { x: 9, y: 9 }])) };
    expect(relayout(moved, H).layout?.start).toEqual({ x: 0, y: autoLayout(branching, H).start.y });
  });

  it("trimLayout drops positions of steps that are gone", () => {
    const flow: Flow = { ...branching, layout: { start: { x: 0, y: 0 }, ghost: { x: 5, y: 5 } } };
    expect(Object.keys(trimLayout(flow).layout ?? {})).toEqual(["start"]);
  });
});

describe("placeNewStep", () => {
  it("puts the new step to the right of its parent", () => {
    const flow = ensureLayout({ start: "m", steps: { m: { id: "m", type: "message", text: "Hola" } } }, H);
    const added = addStep(flow, "m", "next", "pause");
    if (!added.ok) throw new Error(added.error);
    const placed = placeNewStep(added.flow, added.id as string, "m", H);
    expect(placed.layout?.[added.id as string]?.x).toBe((flow.layout?.m.x ?? 0) + NODE_WIDTH + COLUMN_GAP);
  });

  it("moves down when the spot is taken", () => {
    let flow = ensureLayout({ start: "m", steps: { m: { id: "m", type: "message", text: "Hola", buttons: [{ id: "x", title: "X" }, { id: "y", title: "Y" }] } } }, H);
    const first = addStep(flow, "m", "button:x", "pause");
    if (!first.ok) throw new Error(first.error);
    flow = placeNewStep(first.flow, first.id as string, "m", H);
    const second = addStep(flow, "m", "button:y", "pause");
    if (!second.ok) throw new Error(second.error);
    flow = placeNewStep(second.flow, second.id as string, "m", H);
    const a = flow.layout?.[first.id as string];
    const b = flow.layout?.[second.id as string];
    expect(b?.x).toBe(a?.x);
    expect((b?.y ?? 0) - (a?.y ?? 0)).toBeGreaterThanOrEqual(120 + ROW_GAP);
  });
});

describe("positions travel with the flow", () => {
  it("are accepted by the flow check", () => {
    const check = checkFlow({ ...branching, layout: { start: { x: 0, y: 0 } } });
    expect(check.ok).toBe(true);
  });

  it("are refused when they are not numbers", () => {
    const check = checkFlow({ ...branching, layout: { start: { x: "a", y: 0 } } });
    expect(check.ok).toBe(false);
  });

  it("are kept when a step is added and dropped when one is removed", () => {
    const flow = ensureLayout({ start: "m", steps: { m: { id: "m", type: "message", text: "Hola" } } }, H);
    const added = addStep(flow, "m", "next", "pause");
    if (!added.ok) throw new Error(added.error);
    expect(added.flow.layout?.m).toEqual(flow.layout?.m);
    const withPause = placeNewStep(added.flow, added.id as string, "m", H);
    const removed = removeStep(withPause, added.id as string);
    if (!removed.ok) throw new Error(removed.error);
    expect(Object.keys(removed.flow.layout ?? {})).toEqual(["m"]);
  });
});

describe("stepNumbers", () => {
  it("numbers the first step 1 and the rest in the order the flow reaches them", () => {
    const n = stepNumbers(branching);
    expect(n.start).toBe(1);
    // level by level, in the order of the arrows: the buttons first, then "after"
    expect([n.a, n.b, n.c]).toEqual([2, 3, 4]);
    expect(n.end).toBe(5);
  });

  it("does not depend on the order the steps are stored in", () => {
    const shuffled: Flow = { ...branching, steps: Object.fromEntries(Object.entries(branching.steps).reverse()) };
    expect(stepNumbers(shuffled)).toEqual(stepNumbers(branching));
  });

  it("puts steps nothing leads to after the others", () => {
    const flow: Flow = { start: "a", steps: { lost: { id: "lost", type: "message", text: "?" }, a: { id: "a", type: "message", text: "A" } } };
    expect(stepNumbers(flow)).toEqual({ a: 1, lost: 2 });
  });
});
