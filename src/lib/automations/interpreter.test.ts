import { describe, expect, it } from "vitest";
import { checkFlow, type Action, type Flow } from "./flow";
import { MAX_STEPS_PER_BURST, resumeAfterPause, resumeAfterReply, startFlow, type FlowIo } from "./interpreter";
import type { LeadView } from "./text";

const NOW = new Date("2026-11-10T15:00:00Z");

function fakeIo(over: Partial<LeadView> = {}, hooks: Partial<FlowIo> = {}) {
  const log: string[] = [];
  const l: LeadView = {
    name: "Ana Pérez",
    phone: "573001112233",
    email: null,
    tags: [],
    stageId: "st1",
    appointmentAt: null,
    lastText: "hola",
    businessName: "Clínica Sol",
    agendaUrl: null,
    timeZone: "America/Bogota",
    hour: 10,
    ...over,
  };
  const io: FlowIo = {
    lead: () => l,
    now: () => NOW,
    sendText: async (text, opts) => void log.push(`text:${text}${opts.templateId ? `|tpl:${opts.templateId}` : ""}`),
    sendButtons: async (text, buttons) => void log.push(`buttons:${text}|${buttons.map((b) => b.title).join(",")}`),
    sendList: async (text, _b, rows) => void log.push(`list:${text}|${rows.map((r) => r.title).join(",")}`),
    react: async (emoji) => void log.push(`react:${emoji}`),
    addNote: async (t) => void log.push(`note:${t}`),
    notifyTeam: async (t) => void log.push(`team:${t}`),
    classify: async () => null,
    applyAction: async (a: Action) => {
      log.push(`action:${a.kind}${"stageId" in a ? `:${a.stageId}` : ""}${"tag" in a ? `:${a.tag}` : ""}${"value" in a ? `:${a.value}` : ""}`);
      if (a.kind === "add_tag") l.tags.push(a.tag);
      if (a.kind === "move_stage") l.stageId = a.stageId;
      if (a.kind === "set_field" && a.field === "email") l.email = a.value;
    },
    http: async (url, method) => void log.push(`http:${method}:${url}`),
    roundRobin: async (id, ids) => void log.push(`rr:${id}:${ids.join(",")}`),
    startFlow: async (id) => void log.push(`start:${id}`),
    ...hooks,
  };
  return { io, log, lead: l };
}

const flowOf = (steps: unknown, start = "a"): Flow => {
  const r = checkFlow({ start, steps });
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.flow;
};

describe("straight steps", () => {
  it("runs a message, an action and a note in order and finishes", async () => {
    const { io, log } = fakeIo();
    const flow = flowOf({
      a: { id: "a", type: "message", text: "Hola [nombre del lead]", next: "b" },
      b: { id: "b", type: "actions", actions: [{ kind: "add_tag", tag: "Nuevo" }, { kind: "move_stage", stageId: "st2" }], next: "c" },
      c: { id: "c", type: "comment", text: "Entró por [nombre]", next: "d" },
      d: { id: "d", type: "internal", text: "Atender a [nombre del lead]" },
    });
    const r = await startFlow(flow, io);
    expect(r.status).toBe("DONE");
    expect(r.executed).toEqual(["a", "b", "c", "d"]);
    expect(log).toEqual(["text:Hola Ana", "action:add_tag:Nuevo", "action:move_stage:st2", "note:Entró por Ana", "team:Atender a Ana"]);
  });

  it("reacts and fills a field with a tag", async () => {
    const { io, log } = fakeIo();
    const flow = flowOf({
      a: { id: "a", type: "reaction", emoji: "👍", next: "b" },
      b: { id: "b", type: "actions", actions: [{ kind: "set_field", field: "notes", value: "Lead de [nombre del lead]" }] },
    });
    await startFlow(flow, io);
    expect(log).toEqual(["react:👍", "action:set_field:Lead de Ana"]);
  });

  it("stops where asked, and hands over to another flow", async () => {
    const stop = await startFlow(flowOf({ a: { id: "a", type: "stop" } }), fakeIo().io);
    expect(stop.status).toBe("STOPPED");
    const { io, log } = fakeIo();
    const handoff = await startFlow(flowOf({ a: { id: "a", type: "start_flow", automationId: "otro" } }), io);
    expect(handoff.status).toBe("DONE");
    expect(log).toEqual(["start:otro"]);
  });

  it("calls a URL and rotates a round robin", async () => {
    const { io, log } = fakeIo();
    await startFlow(
      flowOf({
        a: { id: "a", type: "http", url: "https://x.test/hook", next: "b" },
        b: { id: "b", type: "round_robin", pipelineIds: ["p1", "p2"] },
      }),
      io,
    );
    expect(log).toEqual(["http:POST:https://x.test/hook", "rr:b:p1,p2"]);
  });
});

describe("waiting for the customer", () => {
  const buttons = flowOf({
    a: { id: "a", type: "message", text: "¿Quieres agendar?", buttons: [{ id: "si", title: "Sí", next: "yes" }, { id: "no", title: "No", next: "no" }], next: "other" },
    yes: { id: "yes", type: "message", text: "Genial" },
    no: { id: "no", type: "message", text: "Entendido" },
    other: { id: "other", type: "message", text: "No te entendí" },
  });

  it("sends the buttons and waits", async () => {
    const { io, log } = fakeIo();
    const r = await startFlow(buttons, io);
    expect(r).toMatchObject({ status: "WAITING_REPLY", stepId: "a" });
    expect(log).toEqual(["buttons:¿Quieres agendar?|Sí,No"]);
  });

  it("follows the button that was tapped, by id or by its text, and a free answer goes on", async () => {
    for (const [reply, said] of [
      [{ text: "x", replyId: "si" }, "Genial"],
      [{ text: "no" }, "Entendido"],
      [{ text: "tal vez más tarde" }, "No te entendí"],
    ] as const) {
      const { io, log } = fakeIo();
      const r = await resumeAfterReply(buttons, "a", reply, {}, io);
      expect(r.status).toBe("DONE");
      expect(log).toEqual([`text:${said}`]);
    }
  });

  it("waits after a plain message when asked to", async () => {
    const f = flowOf({ a: { id: "a", type: "message", text: "¿Tu nombre?", waitForReply: true, next: "b" }, b: { id: "b", type: "message", text: "Gracias" } });
    const { io, log } = fakeIo();
    expect((await startFlow(f, io)).status).toBe("WAITING_REPLY");
    await resumeAfterReply(f, "a", { text: "Ana" }, {}, io);
    expect(log).toEqual(["text:¿Tu nombre?", "text:Gracias"]);
  });

  it("a list goes to the row chosen, shows itself once more on a wrong answer, then moves on", async () => {
    const f = flowOf({
      a: { id: "a", type: "list", text: "Elige", buttonText: "Ver", rows: [{ id: "r1", title: "Precios", next: "p" }, { id: "r2", title: "Horarios", next: "h" }], otherwise: "o" },
      p: { id: "p", type: "message", text: "Precios…" },
      h: { id: "h", type: "message", text: "Horarios…" },
      o: { id: "o", type: "message", text: "Te paso con una persona" },
    });
    const { io, log } = fakeIo();
    expect(await startFlow(f, io)).toMatchObject({ status: "WAITING_REPLY", stepId: "a" });
    const again = await resumeAfterReply(f, "a", { text: "asdf" }, {}, io);
    expect(again).toMatchObject({ status: "WAITING_REPLY", stepId: "a", vars: { attempts: { a: 1 } } });
    const last = await resumeAfterReply(f, "a", { text: "otra cosa" }, again.vars, io);
    expect(last.status).toBe("DONE");
    expect(log).toEqual(["list:Elige|Precios,Horarios", "list:Elige|Precios,Horarios", "text:Te paso con una persona"]);
    const ok = await resumeAfterReply(f, "a", { text: "x", replyId: "r2" }, {}, fakeIo().io);
    expect(ok.executed).toEqual(["h"]);
  });
});

describe("validation", () => {
  const f = flowOf({
    a: { id: "a", type: "validation", kind: "email", prompt: "¿Cuál es tu correo?", retryPrompt: "Ese correo no parece válido, ¿lo escribes de nuevo?", maxRetries: 1, saveTo: "email", ok: "good", fail: "bad" },
    good: { id: "good", type: "message", text: "Anotado" },
    bad: { id: "bad", type: "message", text: "Un asesor te escribirá" },
  });

  it("asks, saves a valid answer and goes on", async () => {
    const { io, log, lead } = fakeIo();
    expect((await startFlow(f, io)).status).toBe("WAITING_REPLY");
    const r = await resumeAfterReply(f, "a", { text: "ANA@x.co" }, {}, io);
    expect(r.status).toBe("DONE");
    expect(lead.email).toBe("ana@x.co");
    expect(log).toEqual(["text:¿Cuál es tu correo?", "action:set_field:ana@x.co", "text:Anotado"]);
  });

  it("asks again on a wrong answer, then takes the failure branch", async () => {
    const { io, log } = fakeIo();
    const first = await resumeAfterReply(f, "a", { text: "no sé" }, {}, io);
    expect(first.status).toBe("WAITING_REPLY");
    const second = await resumeAfterReply(f, "a", { text: "tampoco" }, first.vars, io);
    expect(second.status).toBe("DONE");
    expect(log).toEqual(["text:Ese correo no parece válido, ¿lo escribes de nuevo?", "text:Un asesor te escribirá"]);
  });
});

describe("conditions", () => {
  const f = flowOf({
    a: { id: "a", type: "condition", match: "all", rules: [{ field: "tag", op: "has", value: "VIP" }, { field: "hour", op: "gte", value: 9 }], yes: "y", no: "n" },
    y: { id: "y", type: "message", text: "Trato VIP" },
    n: { id: "n", type: "message", text: "Trato normal" },
  });
  it("takes the yes or the no", async () => {
    const vip = fakeIo({ tags: ["VIP"] });
    await startFlow(f, vip.io);
    expect(vip.log).toEqual(["text:Trato VIP"]);
    const normal = fakeIo();
    await startFlow(f, normal.io);
    expect(normal.log).toEqual(["text:Trato normal"]);
  });

  it("sees what an earlier action changed", async () => {
    const g = flowOf({
      a: { id: "a", type: "actions", actions: [{ kind: "add_tag", tag: "VIP" }], next: "b" },
      b: { id: "b", type: "condition", match: "all", rules: [{ field: "tag", op: "has", value: "vip" }], yes: "y", no: "n" },
      y: { id: "y", type: "stop" },
      n: { id: "n", type: "message", text: "no debería llegar aquí" },
    });
    const { io, log } = fakeIo();
    expect((await startFlow(g, io)).status).toBe("STOPPED");
    expect(log).toEqual(["action:add_tag:VIP"]);
  });
});

describe("AI condition", () => {
  const f = flowOf({
    a: { id: "a", type: "ai_condition", question: "¿Quiere agendar una cita?", outcomes: [{ id: "si", label: "Sí quiere", next: "s" }, { id: "no", label: "No quiere", next: "n" }], otherwise: "o" },
    s: { id: "s", type: "message", text: "Te paso el enlace" },
    n: { id: "n", type: "message", text: "Sin problema" },
    o: { id: "o", type: "message", text: "Un asesor te ayuda" },
  });
  it("follows the outcome the AI picks, and 'otherwise' when it can't tell", async () => {
    for (const [pick, said] of [["si", "Te paso el enlace"], ["no", "Sin problema"], [null, "Un asesor te ayuda"], ["inventado", "Un asesor te ayuda"]] as const) {
      const { io, log } = fakeIo({ lastText: "me interesa" }, { classify: async (_q, _o, text) => (text === "me interesa" ? pick : null) });
      await startFlow(f, io);
      expect(log).toEqual([`text:${said}`]);
    }
  });
  it("fails, instead of guessing, when the AI errors", async () => {
    const { io } = fakeIo({}, { classify: async () => Promise.reject(new Error("sin saldo")) });
    const r = await startFlow(f, io);
    expect(r).toMatchObject({ status: "FAILED", stepId: "a", error: "sin saldo" });
  });
});

describe("pause", () => {
  const f = flowOf({
    a: { id: "a", type: "message", text: "Te escribo en un rato", next: "p" },
    p: { id: "p", type: "pause", amount: 2, unit: "hours", next: "b" },
    b: { id: "b", type: "message", text: "¿Pudiste verlo?" },
  });
  it("waits the time and continues after it", async () => {
    const { io, log } = fakeIo();
    const r = await startFlow(f, io);
    expect(r).toMatchObject({ status: "WAITING_TIME", stepId: "p" });
    if (r.status === "WAITING_TIME") expect(r.resumeAt).toEqual(new Date("2026-11-10T17:00:00Z"));
    const done = await resumeAfterPause(f, "p", r.vars, io);
    expect(done.status).toBe("DONE");
    expect(log).toEqual(["text:Te escribo en un rato", "text:¿Pudiste verlo?"]);
  });
});

describe("when something goes wrong", () => {
  it("fails with the reason when a message can't be sent, and runs nothing after it", async () => {
    const { io, log } = fakeIo({}, { sendText: async () => Promise.reject(new Error("Pasaron más de 24 horas")) });
    const r = await startFlow(flowOf({ a: { id: "a", type: "message", text: "Hola", next: "b" }, b: { id: "b", type: "reaction", emoji: "👍" } }), io);
    expect(r).toMatchObject({ status: "FAILED", stepId: "a", error: "Pasaron más de 24 horas" });
    expect(log).toEqual([]);
  });

  it("stops a loop of jumps instead of spinning", async () => {
    const f = flowOf({ a: { id: "a", type: "goto", target: "b" }, b: { id: "b", type: "goto", target: "a" } });
    const r = await startFlow(f, fakeIo().io);
    expect(r.status).toBe("FAILED");
    expect(r.executed).toHaveLength(MAX_STEPS_PER_BURST);
  });

  it("fails clearly when the step it was waiting at was deleted", async () => {
    const r = await resumeAfterReply(flowOf({ a: { id: "a", type: "stop" } }), "borrado", { text: "hola" }, {}, fakeIo().io);
    expect(r).toMatchObject({ status: "FAILED", stepId: "borrado" });
  });
});
