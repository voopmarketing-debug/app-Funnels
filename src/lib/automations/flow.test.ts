import { describe, expect, it } from "vitest";
import { checkFlow, checkTriggers, nextIds, pauseMs, type Flow } from "./flow";

const flow = (steps: Record<string, unknown>, start = "a") => ({ start, steps });

describe("checkFlow", () => {
  it("accepts a simple flow and lists steps nothing leads to", () => {
    const r = checkFlow(
      flow({
        a: { id: "a", type: "message", text: "Hola [nombre del lead]", next: "b" },
        b: { id: "b", type: "stop" },
        huerfano: { id: "huerfano", type: "stop" },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.unreachable).toEqual(["huerfano"]);
  });

  it("rejects an arrow to a step that doesn't exist", () => {
    const r = checkFlow(flow({ a: { id: "a", type: "message", text: "Hola", next: "nada" } }));
    expect(r).toEqual({ ok: false, errors: ["Paso «a» (Mensaje): apunta al paso «nada», que no existe."] });
  });

  it("rejects a missing start and a step whose id differs from its key", () => {
    const r = checkFlow(flow({ b: { id: "x", type: "stop" } }, "a"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("El paso de inicio no existe.");
      expect(r.errors.join(" ")).toContain("su identificador no coincide");
    }
  });

  it("checks buttons: at most 3, no repeats, not together with a file", () => {
    const four = checkFlow(flow({ a: { id: "a", type: "message", text: "x", buttons: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `T${n}` })) } }));
    expect(four.ok).toBe(false);
    const same = checkFlow(flow({ a: { id: "a", type: "message", text: "x", buttons: [{ id: "b1", title: "Sí" }, { id: "b2", title: "sí" }] } }));
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.errors.join(" ")).toContain("mismo texto");
    const media = checkFlow(flow({ a: { id: "a", type: "message", text: "x", mediaUrl: "https://x.test/a.png", mediaType: "image", buttons: [{ id: "b1", title: "Sí" }] } }));
    if (!media.ok) expect(media.errors.join(" ")).toContain("botones y un archivo");
    else throw new Error("should fail");
  });

  it("limits a pause to 30 days and http to https", () => {
    const pause = checkFlow(flow({ a: { id: "a", type: "pause", amount: 31, unit: "days" } }));
    expect(pause.ok).toBe(false);
    const http = checkFlow(flow({ a: { id: "a", type: "http", url: "http://x.test/hook" } }));
    expect(http.ok).toBe(false);
    expect(checkFlow(flow({ a: { id: "a", type: "pause", amount: 30, unit: "days" } })).ok).toBe(true);
  });

  it("refuses a step that jumps to itself", () => {
    expect(checkFlow(flow({ a: { id: "a", type: "goto", target: "a" } })).ok).toBe(false);
  });

  it("refuses steps this platform doesn't have", () => {
    expect(checkFlow(flow({ a: { id: "a", type: "code", source: "1+1" } })).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("knows where each kind of step can lead", () => {
    const f = checkFlow(
      flow({
        a: { id: "a", type: "message", text: "x", buttons: [{ id: "s", title: "Sí", next: "b" }, { id: "n", title: "No", next: "c" }], next: "d" },
        b: { id: "b", type: "stop" },
        c: { id: "c", type: "stop" },
        d: { id: "d", type: "stop" },
      }),
    ) as { ok: true; flow: Flow };
    expect(nextIds(f.flow.steps.a).sort()).toEqual(["b", "c", "d"]);
  });
  it("converts a pause to milliseconds", () => {
    expect(pauseMs({ amount: 10, unit: "minutes" })).toBe(600_000);
    expect(pauseMs({ amount: 2, unit: "days" })).toBe(172_800_000);
  });
  it("checks triggers", () => {
    expect(checkTriggers([{ type: "new_conversation" }, { type: "message", keywords: ["precio"] }]).ok).toBe(true);
    expect(checkTriggers([{ type: "message", keywords: [] }]).ok).toBe(false);
    expect(checkTriggers([{ type: "telepatia" }]).ok).toBe(false);
  });
});
