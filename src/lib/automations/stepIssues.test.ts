import { describe, expect, it } from "vitest";
import type { Flow } from "./flow";
import { checkFlow } from "./flow";
import { defaultStep } from "./flowEdit";
import { flowIssues, stepIssues } from "./stepIssues";

const flow = (): Flow => ({ start: "a", steps: { a: { id: "a", type: "message", text: "Hola" } } });

describe("stepIssues", () => {
  it("says what is missing, in plain words", () => {
    const f = flow();
    expect(stepIssues({ id: "a", type: "message", text: "  " }, f)).toEqual(["Escribe el mensaje."]);
    expect(stepIssues({ id: "a", type: "message", text: "x", buttons: [{ id: "b", title: "Un botón demasiado largo para WhatsApp" }] }, f)[0]).toContain("más de 20 letras");
    expect(stepIssues({ id: "a", type: "http", url: "https://" }, f)).toHaveLength(1);
    expect(stepIssues({ id: "a", type: "round_robin", pipelineIds: ["p1"] }, f)[0]).toContain("al menos dos embudos");
    expect(stepIssues({ id: "a", type: "start_flow", automationId: "" }, f)).toEqual(["Elige el flujo que se inicia."]);
    expect(stepIssues({ id: "a", type: "goto", target: "nada" }, f)).toEqual(["Elige a qué paso salta."]);
    expect(stepIssues({ id: "a", type: "actions", actions: [{ kind: "move_stage", stageId: "" }] }, f)[0]).toContain("etapa");
    expect(stepIssues({ id: "a", type: "condition", match: "all", rules: [{ field: "message", op: "contains", value: "" }] }, f)).toEqual(["Una regla no tiene valor."]);
  });

  it("has nothing to say about a step that is ready", () => {
    const f = flow();
    for (const type of ["message", "reaction", "comment", "internal", "list", "ai_condition", "pause", "actions", "condition", "validation", "stop"] as const) {
      expect(stepIssues(defaultStep(type, "a", f), f), type).toEqual([]);
    }
  });

  it("agrees with the schema: a flow with no issues can be checked, one with issues cannot", () => {
    const ready = flow();
    expect(flowIssues(ready)).toEqual({});
    expect(checkFlow(ready).ok).toBe(true);
    const broken: Flow = { start: "a", steps: { a: { id: "a", type: "message", text: "" } } };
    expect(Object.keys(flowIssues(broken))).toEqual(["a"]);
    expect(checkFlow(broken).ok).toBe(false);
  });
});
