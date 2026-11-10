import { describe, expect, it } from "vitest";
import { checkFlow, type Flow } from "./flow";
import { addStep, buildTree, defaultStep, newStepId, pruneUnreachable, removeStep, slotsOf, stepTitle, triggerSummary, updateStep, withSlot } from "./flowEdit";
import { referenceErrors, type KnownIds } from "./references";

const base = (): Flow => ({ start: "message_1", steps: { message_1: { id: "message_1", type: "message", text: "Hola" } } });
const must = (r: { ok: boolean; flow?: Flow; error?: string }): Flow => {
  if (!r.ok || !r.flow) throw new Error(r.error);
  return r.flow;
};

describe("addStep", () => {
  it("adds a step after another and keeps the rest of the chain", () => {
    let flow = must(addStep(base(), "message_1", "next", "pause"));
    flow = must(addStep(flow, "message_1", "next", "reaction"));
    // message_1 → reaction_1 → pause_1
    expect(flow.steps.message_1).toMatchObject({ next: "reaction_1" });
    expect(flow.steps.reaction_1).toMatchObject({ next: "pause_1" });
    expect(slotsOf(flow.steps.pause_1)[0].target).toBeNull();
    expect(checkFlow(flow).ok).toBe(true);
  });

  it("puts the rest of the chain on the 'yes' of a condition added in the middle", () => {
    let flow = must(addStep(base(), "message_1", "next", "stop"));
    flow = must(addStep(flow, "message_1", "next", "condition"));
    expect(flow.steps.condition_1).toMatchObject({ yes: "stop_1" });
    expect(flow.steps.message_1).toMatchObject({ next: "condition_1" });
  });

  it("only lets a step that ends the flow go at the end of a path", () => {
    const flow = must(addStep(base(), "message_1", "next", "pause"));
    const refused = addStep(flow, "message_1", "next", "stop");
    expect(refused).toEqual({ ok: false, error: expect.stringContaining("al final de un camino") });
    expect(addStep(flow, "pause_1", "next", "stop").ok).toBe(true);
  });

  it("gives each new step its own id", () => {
    let flow = must(addStep(base(), "message_1", "next", "message"));
    flow = must(addStep(flow, "message_2", "next", "message"));
    expect(Object.keys(flow.steps).sort()).toEqual(["message_1", "message_2", "message_3"]);
    expect(newStepId(flow, "message")).toBe("message_4");
  });

  it("adds inside a branch of a list", () => {
    let flow = must(addStep(base(), "message_1", "next", "list"));
    flow = must(addStep(flow, "list_1", "row:op1", "message"));
    expect(slotsOf(flow.steps.list_1).find((s) => s.key === "row:op1")?.target).toBe("message_2");
    expect(slotsOf(flow.steps.list_1).find((s) => s.key === "row:op2")?.target).toBeNull();
  });

  it("refuses a place that doesn't exist", () => {
    expect(addStep(base(), "nada", "next", "pause").ok).toBe(false);
    expect(addStep(base(), "message_1", "nada", "pause").ok).toBe(false);
  });
});

describe("removeStep", () => {
  const chain = (): Flow => ({
    start: "a",
    steps: {
      a: { id: "a", type: "message", text: "uno", next: "b" },
      b: { id: "b", type: "pause", amount: 1, unit: "hours", next: "c" },
      c: { id: "c", type: "message", text: "tres" },
    },
  });

  it("joins the chain back up", () => {
    const flow = must(removeStep(chain(), "b"));
    expect(flow.steps.a).toMatchObject({ next: "c" });
    expect(flow.steps.b).toBeUndefined();
  });

  it("removing the first step makes the next one the start", () => {
    const flow = must(removeStep(chain(), "a"));
    expect(flow.start).toBe("b");
  });

  it("refuses to remove the only step, or a first step with nothing after it", () => {
    expect(removeStep(base(), "message_1").ok).toBe(false);
    const two: Flow = { start: "a", steps: { a: { id: "a", type: "condition", match: "all", rules: [{ field: "email", op: "missing" }], yes: "b" }, b: { id: "b", type: "stop" } } };
    expect(removeStep(two, "b").ok).toBe(true);
    const lonely: Flow = { start: "a", steps: { a: { id: "a", type: "stop" }, b: { id: "b", type: "stop" } } };
    expect(removeStep(lonely, "a").ok).toBe(false);
  });

  it("takes a branch's own steps with it", () => {
    let flow = must(addStep(base(), "message_1", "next", "condition"));
    flow = must(addStep(flow, "condition_1", "yes", "message"));
    flow = must(addStep(flow, "condition_1", "no", "stop"));
    flow = must(removeStep(flow, "condition_1"));
    // The condition's own "yes" goes on; its "no" branch is gone.
    expect(Object.keys(flow.steps).sort()).toEqual(["message_1", "message_2"]);
    expect(flow.steps.message_1).toMatchObject({ next: "message_2" });
  });

  it("points a jump that aimed at the removed step to what came after it", () => {
    const flow: Flow = {
      start: "a",
      steps: {
        a: { id: "a", type: "message", text: "x", next: "b" },
        b: { id: "b", type: "message", text: "y", next: "c" },
        c: { id: "c", type: "message", text: "z", next: "j" },
        j: { id: "j", type: "goto", target: "b" },
      },
    };
    const after = must(removeStep(flow, "b"));
    expect(after.steps.j).toMatchObject({ target: "c" });
    expect(checkFlow(after).ok).toBe(true);
  });
});

describe("updateStep and prune", () => {
  it("drops what a deleted button led to", () => {
    let flow: Flow = {
      start: "a",
      steps: {
        a: { id: "a", type: "message", text: "¿?", buttons: [{ id: "s", title: "Sí", next: "y" }, { id: "n", title: "No", next: "x" }] },
        y: { id: "y", type: "stop" },
        x: { id: "x", type: "stop" },
      },
    };
    const a = flow.steps.a;
    if (a.type !== "message") throw new Error();
    flow = must(updateStep(flow, { ...a, buttons: a.buttons?.filter((b) => b.id !== "n") }));
    expect(Object.keys(flow.steps).sort()).toEqual(["a", "y"]);
  });
  it("pruneUnreachable keeps what the start reaches", () => {
    const flow = pruneUnreachable({ start: "a", steps: { a: { id: "a", type: "stop" }, z: { id: "z", type: "stop" } } });
    expect(Object.keys(flow.steps)).toEqual(["a"]);
  });
});

describe("defaults", () => {
  it("every kind of step starts with content that can be saved, except the ones that need a choice", () => {
    const flow = base();
    const needChoice = ["start_flow", "http", "round_robin"];
    for (const type of ["message", "reaction", "comment", "internal", "list", "ai_condition", "pause", "actions", "condition", "validation", "goto", "stop"] as const) {
      const step = defaultStep(type, "x", flow);
      expect(checkFlow({ start: "x", steps: { x: step, ...(type === "goto" ? { message_1: flow.steps.message_1 } : {}) } }).ok || type === "goto", type).toBe(true);
    }
    for (const type of needChoice) {
      expect(checkFlow({ start: "x", steps: { x: defaultStep(type as "http", "x", flow) } }).ok, type).toBe(false);
    }
  });
  it("withSlot leaves a step without that arrow alone", () => {
    const stop = defaultStep("stop", "s", base());
    expect(withSlot(stop, "next", "x")).toEqual(stop);
  });
});

describe("tree and labels", () => {
  it("draws each step once and shows a reference where two paths meet", () => {
    const flow: Flow = {
      start: "c",
      steps: {
        c: { id: "c", type: "condition", match: "all", rules: [{ field: "email", op: "missing" }], yes: "m", no: "m" },
        m: { id: "m", type: "message", text: "Hola" },
      },
    };
    const tree = buildTree(flow);
    expect(tree?.slots.map((s) => ("ref" in (s.child ?? {}) ? "ref" : s.child ? "node" : "empty"))).toEqual(["node", "ref"]);
  });
  it("names steps and triggers", () => {
    expect(stepTitle({ id: "a", type: "pause", amount: 2, unit: "hours" })).toBe("Pausa de 2 h");
    expect(triggerSummary({ type: "message", keywords: ["precio", "costo", "valor"] }, () => null)).toBe("Escribe «precio», «costo»…");
    expect(triggerSummary({ type: "stage_changed", stageId: "s1" }, (id) => (id === "s1" ? "Interesado" : null))).toBe("Pasa a «Interesado»");
  });
});

describe("referenceErrors", () => {
  const known: KnownIds = { stages: new Set(["s1"]), pipelines: new Set(["p1", "p2"]), templates: new Set(["t1"]), automations: new Set(["other"]) };
  it("accepts references that belong to the business", () => {
    const flow: Flow = {
      start: "a",
      steps: {
        a: { id: "a", type: "actions", actions: [{ kind: "move_stage", stageId: "s1" }], next: "b" },
        b: { id: "b", type: "round_robin", pipelineIds: ["p1", "p2"], next: "c" },
        c: { id: "c", type: "message", text: "x", templateId: "t1", next: "d" },
        d: { id: "d", type: "start_flow", automationId: "other" },
      },
    };
    expect(referenceErrors(flow, [{ type: "stage_changed", stageId: "s1" }], known, "me")).toEqual([]);
  });
  it("rejects an id from another business, a missing template and a flow that starts itself", () => {
    const flow: Flow = {
      start: "a",
      steps: {
        a: { id: "a", type: "actions", actions: [{ kind: "move_stage", stageId: "ajena" }], next: "b" },
        b: { id: "b", type: "message", text: "x", templateId: "pendiente", next: "c" },
        c: { id: "c", type: "start_flow", automationId: "me" },
      },
    };
    const errors = referenceErrors(flow, [{ type: "stage_changed", stageId: "ajena" }], known, "me");
    expect(errors).toHaveLength(4);
    expect(errors.join(" ")).toContain("a sí mismo");
  });
});
