import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// End to end against a real database, with WhatsApp (graph.facebook.com) faked.
// Only runs on purpose: `RUN_DB_TESTS=1 npx vitest run engine.integration` with
// DATABASE_URL pointing at a throwaway database that has one business with a
// WhatsApp number and a pipeline (the local development one).
const enabled = !!process.env.RUN_DB_TESTS && !!process.env.DATABASE_URL;

vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

describe.skipIf(!enabled)("conversation flows, end to end", () => {
  const sent: { type: string; body: Record<string, unknown> }[] = [];
  let prisma: typeof import("@/lib/prisma").prisma;
  let engine: typeof import("./engine");
  let businessId = "";
  let stageA = "";
  let stageB = "";
  const created = { conversations: [] as string[], automations: [] as string[] };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    engine = await import("./engine");
    const business = await prisma.business.findFirstOrThrow({ where: { wabaAccessToken: { not: null }, wabaPhoneNumberId: { not: null } }, select: { id: true } });
    businessId = business.id;
    await prisma.business.update({ where: { id: businessId }, data: { subscriptionEndsAt: new Date(Date.now() + 30 * 86_400_000) } });
    const stages = await prisma.pipelineStage.findMany({ where: { businessId }, orderBy: { position: "asc" }, take: 2 });
    [stageA, stageB] = stages.map((s) => s.id);
    vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "graph.facebook.com" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        sent.push({ type: String(body.type), body });
        return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (!enabled) return;
    await prisma.automation.deleteMany({ where: { id: { in: created.automations } } });
    await prisma.notification.deleteMany({ where: { conversationId: { in: created.conversations } } });
    await prisma.conversation.deleteMany({ where: { id: { in: created.conversations } } });
  });

  beforeEach(() => {
    sent.length = 0;
  });

  let phoneCounter = 0;
  async function newChat(opts: { writtenAgoMs?: number; aiPaused?: boolean } = {}) {
    const conversation = await prisma.conversation.create({
      data: { businessId, customerPhone: `5739999${String(Date.now()).slice(-5)}${phoneCounter++}`, customerName: "Ana Pérez", stageId: stageA, aiPaused: opts.aiPaused ?? false },
    });
    created.conversations.push(conversation.id);
    await prisma.message.create({ data: { conversationId: conversation.id, role: "CUSTOMER", content: "cuál es el precio", whatsappMsgId: `in.${conversation.id}`, createdAt: new Date(Date.now() - (opts.writtenAgoMs ?? 1000)) } });
    return conversation;
  }

  async function newFlow(name: string, triggers: unknown, steps: Record<string, unknown>, enabled = true) {
    const automation = await prisma.automation.create({ data: { businessId, name, enabled, triggers: triggers as object, definition: { start: "a", steps } as object } });
    created.automations.push(automation.id);
    return automation;
  }

  const inbound = (conversationId: string, text: string, replyId?: string, isNew = false) => engine.handleInboundForFlows({ businessId, conversationId, text, replyId, isNewConversation: isNew });

  it("starts on a keyword, waits for the button, follows it, and counts launches and completions", async () => {
    const flow = await newFlow("Precio", [{ type: "message", keywords: ["precio"] }], {
      a: { id: "a", type: "message", text: "Hola [nombre del lead], ¿te interesa agendar?", buttons: [{ id: "si", title: "Sí", next: "tag" }, { id: "no", title: "No", next: "bye" }] },
      tag: { id: "tag", type: "actions", actions: [{ kind: "add_tag", tag: "Interesado" }, { kind: "move_stage", stageId: stageB }], next: "ok" },
      ok: { id: "ok", type: "message", text: "Genial, te ayudo." },
      bye: { id: "bye", type: "stop" },
    });
    const chat = await newChat();

    expect(await inbound(chat.id, "cuál es el precio")).toEqual({ handled: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("interactive");
    expect(JSON.stringify(sent[0].body)).toContain("Hola Ana");
    let run = await prisma.automationRun.findFirstOrThrow({ where: { conversationId: chat.id } });
    expect(run).toMatchObject({ status: "WAITING_REPLY", stepId: "a" });
    expect((await prisma.automation.findUniqueOrThrow({ where: { id: flow.id } })).launches).toBe(1);

    // The AI stays out while the flow waits; the answer goes to the flow.
    expect(await inbound(chat.id, "Sí", "si")).toEqual({ handled: true });
    run = await prisma.automationRun.findFirstOrThrow({ where: { conversationId: chat.id } });
    expect(run.status).toBe("DONE");
    const after = await prisma.conversation.findUniqueOrThrow({ where: { id: chat.id } });
    expect(after.tags).toContain("Interesado");
    expect(after.stageId).toBe(stageB);
    expect(sent.map((m) => m.type)).toEqual(["interactive", "text"]);
    expect((await prisma.automation.findUniqueOrThrow({ where: { id: flow.id } })).completed).toBe(1);
    const stored = await prisma.message.findMany({ where: { conversationId: chat.id, role: "AGENT" }, orderBy: { createdAt: "asc" } });
    expect(stored.map((m) => m.content)).toEqual([expect.stringContaining("▫ Sí"), "Genial, te ayudo."]);

    // Once finished, the chat is the AI's again (and the same keyword starts the flow anew).
    const again = await inbound(chat.id, "gracias");
    expect(again).toEqual({ handled: false });
  });

  it("doesn't start for another keyword, a disabled flow or a chat a person took over", async () => {
    await newFlow("Apagado", [{ type: "message", keywords: ["apagado"] }], { a: { id: "a", type: "message", text: "no debe salir" } }, false);
    await newFlow("Solo hola", [{ type: "message", keywords: ["hola"] }], { a: { id: "a", type: "message", text: "no debe salir" } });
    const chat = await newChat();
    expect(await inbound(chat.id, "apagado")).toEqual({ handled: false });
    expect(await inbound(chat.id, "quiero un descuento")).toEqual({ handled: false });
    const taken = await newChat({ aiPaused: true });
    expect(await inbound(taken.id, "hola")).toEqual({ handled: false });
    expect(sent).toHaveLength(0);
  });

  it("starts on a new conversation", async () => {
    await newFlow("Bienvenida", [{ type: "new_conversation" }], { a: { id: "a", type: "message", text: "Bienvenida a [nombre del negocio]" } });
    const chat = await newChat();
    expect(await inbound(chat.id, "buenas", undefined, true)).toEqual({ handled: true });
    expect(await inbound((await newChat()).id, "buenas", undefined, false)).toEqual({ handled: false });
    expect(sent).toHaveLength(1);
  });

  it("pauses, and the scheduler continues it once the time is up", async () => {
    await newFlow("Seguimiento", [{ type: "message", keywords: ["seguimiento"] }], {
      a: { id: "a", type: "message", text: "Te escribo luego", next: "p" },
      p: { id: "p", type: "pause", amount: 1, unit: "hours", next: "b" },
      b: { id: "b", type: "message", text: "¿Pudiste verlo?" },
    });
    const chat = await newChat();
    expect(await inbound(chat.id, "seguimiento")).toEqual({ handled: true });
    let run = await prisma.automationRun.findFirstOrThrow({ where: { conversationId: chat.id } });
    expect(run.status).toBe("WAITING_TIME");
    expect(run.resumeAt!.getTime()).toBeGreaterThan(Date.now() + 50 * 60_000);

    // Not time yet: nothing happens.
    expect((await engine.runDueAutomations()).resumed).toBe(0);
    // While paused, the AI keeps answering the chat.
    expect(await inbound(chat.id, "ok gracias")).toEqual({ handled: false });

    await prisma.automationRun.update({ where: { id: run.id }, data: { resumeAt: new Date(Date.now() - 1000) } });
    const result = await engine.runDueAutomations();
    expect(result.resumed).toBeGreaterThanOrEqual(1);
    run = await prisma.automationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(run.status).toBe("DONE");
    expect(sent.map((m) => JSON.stringify(m.body))).toEqual([expect.stringContaining("Te escribo luego"), expect.stringContaining("¿Pudiste verlo?")]);
    // A second sweep doesn't send it again.
    sent.length = 0;
    await engine.runDueAutomations();
    expect(sent).toHaveLength(0);
  });

  it("fails clearly outside the 24 h window, warns the team and leaves the chat to the AI", async () => {
    await newFlow("Fuera de ventana", [{ type: "message", keywords: ["ventana"] }], { a: { id: "a", type: "message", text: "Hola de nuevo" } });
    const chat = await newChat({ writtenAgoMs: 30 * 3_600_000 });
    expect(await inbound(chat.id, "ventana")).toEqual({ handled: false });
    expect(sent).toHaveLength(0);
    const run = await prisma.automationRun.findFirstOrThrow({ where: { conversationId: chat.id } });
    expect(run.status).toBe("FAILED");
    expect(run.lastError).toContain("24 horas");
    const note = await prisma.notification.findFirstOrThrow({ where: { conversationId: chat.id, type: "AUTOMATION_FAILED" } });
    expect(note.message).toContain("Fuera de ventana");
  });

  it("starts a flow from an event, once, and never twice at the same time", async () => {
    await newFlow("Etapa", [{ type: "stage_changed", stageId: stageB }], { a: { id: "a", type: "message", text: "Pasaste de etapa" } });
    const chat = await newChat();
    expect(await engine.fireFlowEvent({ businessId, conversationId: chat.id, event: { type: "stage_changed", stageId: stageB } })).toEqual({ started: true });
    expect(await engine.fireFlowEvent({ businessId, conversationId: chat.id, event: { type: "stage_changed", stageId: stageA } })).toEqual({ started: false });
    expect(sent).toHaveLength(1);
  });

  it("two copies of the same answer only continue the flow once", async () => {
    await newFlow("Doble", [{ type: "message", keywords: ["doble"] }], {
      a: { id: "a", type: "message", text: "¿Sí o no?", buttons: [{ id: "si", title: "Sí", next: "b" }, { id: "no", title: "No", next: "b" }] },
      b: { id: "b", type: "message", text: "Recibido" },
    });
    const chat = await newChat();
    await inbound(chat.id, "doble");
    sent.length = 0;
    await Promise.all([inbound(chat.id, "Sí", "si"), inbound(chat.id, "Sí", "si")]);
    expect(sent.filter((m) => m.type === "text")).toHaveLength(1);
  });

  it("gives up waiting after a day and hands the chat back", async () => {
    await newFlow("Silencio", [{ type: "message", keywords: ["silencio"] }], { a: { id: "a", type: "message", text: "¿Hola?", waitForReply: true } });
    const chat = await newChat();
    await inbound(chat.id, "silencio");
    await prisma.automationRun.updateMany({ where: { conversationId: chat.id }, data: { updatedAt: new Date(Date.now() - 25 * 3_600_000) } });
    expect((await engine.runDueAutomations()).closedSilent).toBeGreaterThanOrEqual(1);
    expect((await prisma.automationRun.findFirstOrThrow({ where: { conversationId: chat.id } })).status).toBe("STOPPED");
    sent.length = 0;
    expect(await inbound(chat.id, "ahora sí")).toEqual({ handled: false });
  });
});
