import { describe, expect, it } from "vitest";
import type { Flow } from "./flow";
import { removeStep, updateStep } from "./flowEdit";
import { addFloatingStep, connectSlot, disconnectSlot, looseSteps, moveStep, setStart } from "./flowGraph";

const flow: Flow = {
  start: "hi",
  steps: {
    hi: { id: "hi", type: "message", text: "Hola", buttons: [{ id: "yes", title: "Sí", next: "thanks" }], next: "bye" },
    thanks: { id: "thanks", type: "message", text: "Gracias" },
    bye: { id: "bye", type: "stop" },
  },
  layout: { hi: { x: 0, y: 0 }, thanks: { x: 440, y: 0 }, bye: { x: 440, y: 200 } },
};

const ok = (r: { ok: boolean }) => {
  if (!r.ok) throw new Error("expected ok");
  return r as { ok: true; flow: Flow; id?: string };
};

describe("connectSlot / disconnectSlot", () => {
  it("points an arrow at another card", () => {
    const out = ok(connectSlot(flow, "hi", "next", "thanks")).flow;
    expect(out.steps.hi).toMatchObject({ next: "thanks" });
  });

  it("works on a button", () => {
    const out = ok(connectSlot(flow, "hi", "button:yes", "bye")).flow;
    expect((out.steps.hi as { buttons: { next?: string }[] }).buttons[0].next).toBe("bye");
  });

  it("refuses an arrow to itself, to a missing card or from a missing place", () => {
    expect(connectSlot(flow, "hi", "next", "hi").ok).toBe(false);
    expect(connectSlot(flow, "hi", "next", "ghost").ok).toBe(false);
    expect(connectSlot(flow, "hi", "button:nope", "thanks").ok).toBe(false);
    expect(connectSlot(flow, "ghost", "next", "thanks").ok).toBe(false);
  });

  it("takes an arrow away without deleting the card it led to", () => {
    const out = ok(disconnectSlot(flow, "hi", "button:yes")).flow;
    expect((out.steps.hi as { buttons: { next?: string }[] }).buttons[0].next).toBeUndefined();
    expect(out.steps.thanks).toBeDefined();
    expect(looseSteps(out)).toEqual(["thanks"]);
  });
});

describe("addFloatingStep / moveStep / setStart", () => {
  it("drops a new card, unconnected, at the position given", () => {
    const res = ok(addFloatingStep(flow, "pause", { x: 123.4, y: 55.6 }));
    expect(res.flow.layout?.[res.id as string]).toEqual({ x: 123, y: 56 });
    expect(looseSteps(res.flow)).toEqual([res.id]);
  });

  it("moves a card and leaves the rest where they are", () => {
    const moved = moveStep(flow, "thanks", { x: 10, y: 20 });
    expect(moved.layout?.thanks).toEqual({ x: 10, y: 20 });
    expect(moved.layout?.hi).toEqual({ x: 0, y: 0 });
    expect(moveStep(flow, "ghost", { x: 1, y: 1 })).toBe(flow);
  });

  it("changes where the flow starts", () => {
    expect(ok(setStart(flow, "thanks")).flow.start).toBe("thanks");
    expect(setStart(flow, "ghost").ok).toBe(false);
  });
});

describe("looseSteps", () => {
  it("is empty when every card is reachable, jumps included", () => {
    expect(looseSteps(flow)).toEqual([]);
    const jump: Flow = { start: "a", steps: { a: { id: "a", type: "message", text: "A", next: "g" }, g: { id: "g", type: "goto", target: "b" }, b: { id: "b", type: "stop" } } };
    expect(looseSteps(jump)).toEqual([]);
  });
});

describe("the free canvas keeps unconnected cards", () => {
  it("updateStep without pruning keeps what a deleted button led to", () => {
    const edited = { ...flow.steps.hi, buttons: [] } as Flow["steps"][string];
    const pruned = ok(updateStep(flow, edited)).flow;
    const kept = ok(updateStep(flow, edited, { prune: false })).flow;
    expect(pruned.steps.thanks).toBeUndefined();
    expect(kept.steps.thanks).toBeDefined();
    expect(kept.layout?.thanks).toEqual({ x: 440, y: 0 });
  });

  it("removeStep without pruning leaves other loose cards alone, and forgets the removed one's position", () => {
    const loose = ok(addFloatingStep(flow, "pause", { x: 900, y: 900 }));
    const out = ok(removeStep(loose.flow, "thanks", { prune: false })).flow;
    expect(out.steps[loose.id as string]).toBeDefined();
    expect(out.layout?.thanks).toBeUndefined();
    expect(ok(removeStep(loose.flow, "thanks")).flow.steps[loose.id as string]).toBeUndefined();
  });
});

describe("addBeforeStart", () => {
  it("puts a step in front of the first one and makes it the start", async () => {
    const { addBeforeStart } = await import("./flowGraph");
    const res = ok(addBeforeStart(flow, "pause"));
    expect(res.flow.start).toBe(res.id);
    expect(res.flow.steps[res.id as string]).toMatchObject({ type: "pause", next: "hi" });
  });

  it("refuses a step that ends the flow", async () => {
    const { addBeforeStart } = await import("./flowGraph");
    expect(addBeforeStart(flow, "stop").ok).toBe(false);
  });
});
