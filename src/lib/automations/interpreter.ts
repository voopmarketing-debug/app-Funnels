import { pauseMs, type Action, type Flow, type Step } from "./flow";
import { evaluateRules, matchesChoice, renderText, validateAnswer, type LeadView } from "./text";

// Walks a flow step by step. It decides the order; everything that touches the
// outside world (WhatsApp, the database, Claude) goes through `FlowIo`, so the
// whole logic can be tested without any of them. A run stops where it has to
// wait for the customer or for time to pass, and is picked up again from there.

type Of<T extends Step["type"]> = Extract<Step, { type: T }>;

export interface FlowIo {
  /** The person right now: actions that change tags or the stage show up here for the next condition. */
  lead(): LeadView;
  now(): Date;
  /** Sends or throws. Inside the 24 h window it goes as written; outside it only an approved template can. */
  sendText(text: string, opts: { templateId?: string; mediaUrl?: string; mediaType?: "image" | "document" | "video" }): Promise<void>;
  sendButtons(text: string, buttons: { id: string; title: string }[], opts: { templateId?: string }): Promise<void>;
  sendList(text: string, buttonText: string, rows: { id: string; title: string; description?: string }[], opts: { templateId?: string }): Promise<void>;
  /** A failed reaction never stops a flow: implementations swallow their own errors. */
  react(emoji: string): Promise<void>;
  addNote(text: string): Promise<void>;
  notifyTeam(text: string): Promise<void>;
  /** The id of the outcome the customer's reply fits, or null when none does. */
  classify(question: string, outcomes: { id: string; label: string }[], customerText: string): Promise<string | null>;
  applyAction(action: Action): Promise<void>;
  /** A failed call never stops a flow: implementations swallow their own errors. */
  http(url: string, method: "GET" | "POST"): Promise<void>;
  roundRobin(stepId: string, pipelineIds: string[]): Promise<void>;
  startFlow(automationId: string): Promise<void>;
}

export type Vars = {
  /** How many times a list or validation step was answered wrongly. */
  attempts?: Record<string, number>;
};

export type RunOutcome =
  | { status: "WAITING_REPLY"; stepId: string; vars: Vars; executed: string[] }
  | { status: "WAITING_TIME"; stepId: string; resumeAt: Date; vars: Vars; executed: string[] }
  | { status: "DONE" | "STOPPED"; vars: Vars; executed: string[] }
  | { status: "FAILED"; stepId: string | null; error: string; vars: Vars; executed: string[] };

/** One run never executes more than this many steps in a row: a loop of jumps ends instead of spinning. */
export const MAX_STEPS_PER_BURST = 40;
const DEFAULT_RETRIES = 2;
/** A list answered wrongly is shown once more, then the flow moves on. */
const LIST_RETRIES = 1;

export type Reply = { text: string; replyId?: string };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

/** Runs `flow` from its first step. */
export function startFlow(flow: Flow, io: FlowIo): Promise<RunOutcome> {
  return runFrom(flow, flow.start, {}, io);
}

/** Continues after the customer answered the step the run was waiting at. */
export async function resumeAfterReply(flow: Flow, waitingStepId: string, reply: Reply, vars: Vars, io: FlowIo): Promise<RunOutcome> {
  const step = flow.steps[waitingStepId];
  if (!step) return { status: "FAILED", stepId: waitingStepId, error: "El paso en el que esperaba ya no existe.", vars, executed: [] };
  const attempts = { ...(vars.attempts ?? {}) };
  const withAttempts = (): Vars => ({ ...vars, attempts });

  try {
    if (step.type === "message") {
      const chosen = step.buttons?.find((b) => matchesChoice(b, reply));
      return runFrom(flow, chosen ? chosen.next : step.next, withAttempts(), io);
    }

    if (step.type === "list") {
      const row = step.rows.find((r) => matchesChoice(r, reply));
      if (row) return runFrom(flow, row.next, withAttempts(), io);
      attempts[step.id] = (attempts[step.id] ?? 0) + 1;
      if (attempts[step.id] <= LIST_RETRIES) {
        const lead = io.lead();
        await io.sendList(renderText(step.text, lead), step.buttonText, step.rows, { templateId: undefined });
        return { status: "WAITING_REPLY", stepId: step.id, vars: withAttempts(), executed: [step.id] };
      }
      return runFrom(flow, step.otherwise, withAttempts(), io);
    }

    if (step.type === "validation") {
      const answer = validateAnswer(step.kind, reply.text);
      if (answer.ok) {
        if (step.saveTo) await io.applyAction({ kind: "set_field", field: step.saveTo, value: answer.value });
        return runFrom(flow, step.ok, withAttempts(), io);
      }
      attempts[step.id] = (attempts[step.id] ?? 0) + 1;
      if (attempts[step.id] <= (step.maxRetries ?? DEFAULT_RETRIES)) {
        await io.sendText(renderText(step.retryPrompt ?? step.prompt, io.lead()), {});
        return { status: "WAITING_REPLY", stepId: step.id, vars: withAttempts(), executed: [step.id] };
      }
      return runFrom(flow, step.fail, withAttempts(), io);
    }
  } catch (err) {
    return { status: "FAILED", stepId: step.id, error: errorText(err), vars: withAttempts(), executed: [step.id] };
  }
  // A step that doesn't wait for anything: nothing to read, just go on.
  return runFrom(flow, nextOf(step), vars, io);
}

/** Continues after a Pause ran out. */
export function resumeAfterPause(flow: Flow, pauseStepId: string, vars: Vars, io: FlowIo): Promise<RunOutcome> {
  const step = flow.steps[pauseStepId];
  if (!step) return Promise.resolve({ status: "FAILED", stepId: pauseStepId, error: "El paso de pausa ya no existe.", vars, executed: [] });
  return runFrom(flow, nextOf(step), vars, io);
}

function nextOf(step: Step): string | null | undefined {
  return "next" in step ? step.next : undefined;
}

async function runFrom(flow: Flow, from: string | null | undefined, vars: Vars, io: FlowIo): Promise<RunOutcome> {
  const executed: string[] = [];
  let current = from ?? null;
  while (current) {
    if (executed.length >= MAX_STEPS_PER_BURST) {
      return { status: "FAILED", stepId: current, error: "El flujo dio demasiadas vueltas seguidas y se detuvo.", vars, executed };
    }
    const step: Step | undefined = flow.steps[current];
    if (!step) return { status: "FAILED", stepId: current, error: `El paso «${current}» no existe.`, vars, executed };
    executed.push(step.id);

    try {
      const result = await execute(step, io);
      if (result.kind === "wait") return { status: "WAITING_REPLY", stepId: step.id, vars, executed };
      if (result.kind === "sleep") return { status: "WAITING_TIME", stepId: step.id, resumeAt: result.resumeAt, vars, executed };
      if (result.kind === "stop") return { status: result.status, vars, executed };
      current = result.next ?? null;
    } catch (err) {
      return { status: "FAILED", stepId: step.id, error: errorText(err), vars, executed };
    }
  }
  return { status: "DONE", vars, executed };
}

type StepResult = { kind: "next"; next: string | null | undefined } | { kind: "wait" } | { kind: "sleep"; resumeAt: Date } | { kind: "stop"; status: "DONE" | "STOPPED" };

async function execute(step: Step, io: FlowIo): Promise<StepResult> {
  switch (step.type) {
    case "message":
      return runMessage(step, io);

    case "reaction":
      await io.react(step.emoji);
      return { kind: "next", next: step.next };

    case "comment":
      await io.addNote(renderText(step.text, io.lead()));
      return { kind: "next", next: step.next };

    case "internal":
      await io.notifyTeam(renderText(step.text, io.lead()));
      return { kind: "next", next: step.next };

    case "list":
      await io.sendList(renderText(step.text, io.lead()), step.buttonText, step.rows, {});
      return { kind: "wait" };

    case "ai_condition": {
      const lead = io.lead();
      const chosen = await io.classify(
        step.question,
        step.outcomes.map((o) => ({ id: o.id, label: o.label })),
        lead.lastText,
      );
      const outcome = step.outcomes.find((o) => o.id === chosen);
      return { kind: "next", next: outcome ? outcome.next : step.otherwise };
    }

    case "pause":
      return { kind: "sleep", resumeAt: new Date(io.now().getTime() + pauseMs(step)) };

    case "actions": {
      for (const action of step.actions) {
        // A field value can carry [tags]: "Cliente de [nombre del lead]".
        await io.applyAction(action.kind === "set_field" ? { ...action, value: renderText(action.value, io.lead()) } : action);
      }
      return { kind: "next", next: step.next };
    }

    case "condition":
      return { kind: "next", next: evaluateRules(step.match, step.rules, io.lead()) ? step.yes : step.no };

    case "validation":
      await io.sendText(renderText(step.prompt, io.lead()), {});
      return { kind: "wait" };

    case "goto":
      return { kind: "next", next: step.target };

    case "start_flow":
      await io.startFlow(step.automationId);
      // The conversation is handed to the other flow: this one is finished.
      return { kind: "stop", status: "DONE" };

    case "http":
      await io.http(step.url, step.method ?? "POST");
      return { kind: "next", next: step.next };

    case "round_robin":
      await io.roundRobin(step.id, step.pipelineIds);
      return { kind: "next", next: step.next };

    case "stop":
      return { kind: "stop", status: "STOPPED" };
  }
}

async function runMessage(step: Of<"message">, io: FlowIo): Promise<StepResult> {
  const text = renderText(step.text, io.lead());
  if (step.buttons?.length) {
    await io.sendButtons(text, step.buttons.map((b) => ({ id: b.id, title: b.title })), { templateId: step.templateId });
    return { kind: "wait" };
  }
  await io.sendText(text, { templateId: step.templateId, mediaUrl: step.mediaUrl, mediaType: step.mediaType });
  return step.waitForReply ? { kind: "wait" } : { kind: "next", next: step.next };
}
