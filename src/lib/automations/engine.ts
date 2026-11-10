import { after } from "next/server";
import type { Automation, AutomationRun, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { contactLabel } from "@/lib/contactDisplay";
import { checkFlow, checkTriggers } from "./flow";
import { resumeAfterPause, resumeAfterReply, startFlow, type Reply, type RunOutcome, type Vars } from "./interpreter";
import { createFlowIo, type IoState } from "./io";
import { matchesTrigger, type FlowEvent } from "./text";

// Starts flows when something happens, saves where each conversation is in its
// flow, and picks it up again when the customer answers or a pause ends. All
// the step logic lives in interpreter.ts; this file is the bookkeeping.

const ACTIVE = ["RUNNING", "WAITING_REPLY", "WAITING_TIME"];
/** A flow waiting for an answer gives the chat back to the AI after this long (the WhatsApp window anyway). */
export const WAIT_REPLY_TTL_MS = 24 * 60 * 60 * 1000;
/** A run still "RUNNING" after this long died with its function: it is closed instead of blocking the chat. */
const STUCK_RUNNING_MS = 5 * 60 * 1000;
/** A flow can hand the chat to another, which can hand it on: never more than this deep. */
const MAX_HANDOFF_DEPTH = 3;

type BusinessLite = { id: string; name: string; wabaPhoneNumberId: string | null; wabaAccessToken: string | null; subscriptionEndsAt: Date | null };

const businessSelect = { id: true, name: true, wabaPhoneNumberId: true, wabaAccessToken: true, subscriptionEndsAt: true } as const;

async function loadBusiness(businessId: string): Promise<BusinessLite | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: businessSelect });
  // No WhatsApp or an expired subscription: nothing is sent, so no flow runs.
  if (!business?.wabaAccessToken || !isSubscriptionActive(business.subscriptionEndsAt)) return null;
  return business;
}

const isTerminal = (o: RunOutcome) => o.status === "DONE" || o.status === "STOPPED" || o.status === "FAILED";

/** Saves what happened, counts it, warns the team of a failure and hands over to the next flow if asked. */
async function persist(
  run: { id: string; automationId: string; businessId: string; conversationId: string },
  automation: { name: string },
  business: BusinessLite,
  outcome: RunOutcome,
  state: IoState,
  depth: number,
): Promise<void> {
  const terminal = isTerminal(outcome);
  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: outcome.status,
      vars: outcome.vars as Prisma.InputJsonValue,
      stepId: "stepId" in outcome ? outcome.stepId : null,
      resumeAt: outcome.status === "WAITING_TIME" ? outcome.resumeAt : null,
      lastError: outcome.status === "FAILED" ? outcome.error : null,
      finishedAt: terminal ? new Date() : null,
    },
  });
  if (outcome.status === "DONE") await prisma.automation.update({ where: { id: run.automationId }, data: { completed: { increment: 1 } } });
  if (outcome.status === "FAILED") {
    const conversation = await prisma.conversation.findUnique({ where: { id: run.conversationId }, select: { customerName: true, customerPhone: true } });
    const label = conversation ? contactLabel(conversation.customerName, conversation.customerPhone) : "un cliente";
    await prisma.notification.create({
      data: {
        businessId: run.businessId,
        conversationId: run.conversationId,
        type: "AUTOMATION_FAILED",
        message: `⚠ El flujo «${automation.name}» se detuvo con ${label}: ${outcome.error} La IA sigue atendiendo la conversación.`,
      },
    });
  }
  if (terminal && state.pendingStart && depth < MAX_HANDOFF_DEPTH) {
    const next = await prisma.automation.findFirst({ where: { id: state.pendingStart, businessId: run.businessId } });
    if (next) await launch(next, business, run.conversationId, "", depth + 1);
  }
}

type Launched = { outcome: RunOutcome; state: IoState };

/** Starts `automation` for a conversation, unless the chat is already inside a flow. */
async function launch(automation: Automation, business: BusinessLite, conversationId: string, customerText: string, depth = 0): Promise<Launched | null> {
  const checked = checkFlow(automation.definition);
  if (!checked.ok) {
    console.error(`[flows] «${automation.name}» has an invalid definition: ${checked.errors[0]}`);
    return null;
  }
  const busy = await prisma.automationRun.findFirst({ where: { conversationId, status: { in: ACTIVE } }, select: { id: true } });
  if (busy) return null;

  const run = await prisma.automationRun.create({
    data: { businessId: business.id, automationId: automation.id, conversationId, status: "RUNNING", stepId: checked.flow.start },
  });
  await prisma.automation.update({ where: { id: automation.id }, data: { launches: { increment: 1 } } });

  let launched: Launched;
  try {
    const { io, state } = await createFlowIo({ business, conversationId, automationId: automation.id, customerText });
    launched = { outcome: await startFlow(checked.flow, io), state };
  } catch (err) {
    launched = { outcome: { status: "FAILED", stepId: null, error: err instanceof Error ? err.message.slice(0, 300) : String(err), vars: {}, executed: [] }, state: { sent: 0, pendingStart: null } };
  }
  await persist(run, automation, business, launched.outcome, launched.state, depth);
  return launched;
}

/** True when the AI should stay quiet because the flow already answered (or is waiting for the answer). */
function flowAnswered({ outcome, state }: Launched): boolean {
  if (outcome.status === "FAILED") return false;
  return state.sent > 0 || outcome.status === "WAITING_REPLY" || outcome.status === "WAITING_TIME";
}

/** The first enabled flow of the business that one of the events starts. */
async function findMatching(businessId: string, events: FlowEvent[]): Promise<Automation | null> {
  const automations = await prisma.automation.findMany({ where: { businessId, enabled: true }, orderBy: { createdAt: "asc" } });
  for (const automation of automations) {
    const triggers = checkTriggers(automation.triggers);
    if (!triggers.ok) continue;
    if (triggers.triggers.some((t) => events.some((e) => matchesTrigger(t, e)))) return automation;
  }
  return null;
}

/**
 * A customer message arrived. If the chat is waiting for an answer inside a
 * flow, the answer goes to the flow; otherwise a flow whose trigger matches
 * starts. `handled` tells the AI agent to stay quiet for this message.
 */
export async function handleInboundForFlows(args: {
  businessId: string;
  conversationId: string;
  text: string;
  replyId?: string;
  isNewConversation: boolean;
}): Promise<{ handled: boolean }> {
  const business = await loadBusiness(args.businessId);
  if (!business) return { handled: false };

  const active = await prisma.automationRun.findFirst({
    where: { conversationId: args.conversationId, status: { in: ACTIVE } },
    orderBy: { startedAt: "desc" },
    include: { automation: true },
  });

  if (active?.status === "WAITING_REPLY") {
    if (Date.now() - active.updatedAt.getTime() < WAIT_REPLY_TTL_MS) {
      const launched = await resumeRun(active, business, { text: args.text, replyId: args.replyId });
      return { handled: launched != null && flowAnswered(launched) };
    }
    // Nobody answered for a day: the flow gives the chat back and this message is treated as a new one.
    await prisma.automationRun.update({ where: { id: active.id }, data: { status: "STOPPED", lastError: "El cliente no respondió.", finishedAt: new Date() } });
  } else if (active) {
    // Running, or paused until a set time: the AI keeps answering meanwhile, and no second flow starts.
    return { handled: false };
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: args.conversationId }, select: { aiPaused: true } });
  // A person took over this chat: nothing starts on its own.
  if (!conversation || conversation.aiPaused) return { handled: false };

  const events: FlowEvent[] = [{ type: "message", text: args.text }, ...(args.isNewConversation ? [{ type: "new_conversation" } as const] : [])];
  const automation = await findMatching(business.id, events);
  if (!automation) return { handled: false };
  const launched = await launch(automation, business, args.conversationId, args.text);
  return { handled: launched != null && flowAnswered(launched) };
}

/** Something other than a message happened (stage changed, tag added, appointment booked). */
export async function fireFlowEvent(args: { businessId: string; conversationId: string; event: FlowEvent }): Promise<{ started: boolean }> {
  const business = await loadBusiness(args.businessId);
  if (!business) return { started: false };
  const conversation = await prisma.conversation.findUnique({ where: { id: args.conversationId }, select: { aiPaused: true } });
  if (!conversation || conversation.aiPaused) return { started: false };
  const automation = await findMatching(business.id, [args.event]);
  if (!automation) return { started: false };
  const last = await lastCustomerText(args.conversationId);
  return { started: (await launch(automation, business, args.conversationId, last)) != null };
}

/**
 * Fires an event without making the caller wait or fail: whatever the person
 * did (move a card, book an appointment) is already done, and a flow that can't
 * start is only logged. Runs after the response when there is a request to hang
 * it on, right away otherwise.
 */
export function fireFlowEventInBackground(args: { businessId: string; conversationId: string; event: FlowEvent }): void {
  const run = () =>
    fireFlowEvent(args).catch((err) => {
      console.error("[flows] event failed:", err instanceof Error ? err.message : err);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}

async function lastCustomerText(conversationId: string): Promise<string> {
  const last = await prisma.message.findFirst({ where: { conversationId, role: "CUSTOMER" }, orderBy: { createdAt: "desc" }, select: { content: true } });
  return last?.content ?? "";
}

type RunWithAutomation = AutomationRun & { automation: Automation };

/** Takes a run out of its wait. False when someone else already did (the webhook was delivered twice). */
async function claim(run: AutomationRun): Promise<boolean> {
  const claimed = await prisma.automationRun.updateMany({ where: { id: run.id, status: run.status }, data: { status: "RUNNING" } });
  return claimed.count > 0;
}

async function resumeRun(run: RunWithAutomation, business: BusinessLite, reply: Reply): Promise<Launched | null> {
  const checked = checkFlow(run.automation.definition);
  if (!run.stepId || !checked.ok) {
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", lastError: "El flujo ya no es válido.", finishedAt: new Date() } });
    return null;
  }
  if (!(await claim(run))) return null;
  let resumed: Launched;
  try {
    const { io, state } = await createFlowIo({ business, conversationId: run.conversationId, automationId: run.automationId, customerText: reply.text });
    resumed = { outcome: await resumeAfterReply(checked.flow, run.stepId, reply, (run.vars ?? {}) as Vars, io), state };
  } catch (err) {
    resumed = { outcome: { status: "FAILED", stepId: run.stepId, error: err instanceof Error ? err.message.slice(0, 300) : String(err), vars: (run.vars ?? {}) as Vars, executed: [] }, state: { sent: 0, pendingStart: null } };
  }
  await persist(run, run.automation, business, resumed.outcome, resumed.state, 0);
  return resumed;
}

async function resumePause(run: RunWithAutomation): Promise<void> {
  const business = await loadBusiness(run.businessId);
  if (!business) {
    // Subscription over or WhatsApp disconnected while it waited: it ends instead of sending later.
    await prisma.automationRun.updateMany({ where: { id: run.id, status: "WAITING_TIME" }, data: { status: "STOPPED", lastError: "El negocio ya no puede enviar mensajes.", finishedAt: new Date() } });
    return;
  }
  const checked = checkFlow(run.automation.definition);
  if (!run.stepId || !checked.ok) {
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", lastError: "El flujo ya no es válido.", finishedAt: new Date() } });
    return;
  }
  if (!(await claim(run))) return;
  let resumed: Launched;
  try {
    const { io, state } = await createFlowIo({ business, conversationId: run.conversationId, automationId: run.automationId, customerText: await lastCustomerText(run.conversationId) });
    resumed = { outcome: await resumeAfterPause(checked.flow, run.stepId, (run.vars ?? {}) as Vars, io), state };
  } catch (err) {
    resumed = { outcome: { status: "FAILED", stepId: run.stepId, error: err instanceof Error ? err.message.slice(0, 300) : String(err), vars: (run.vars ?? {}) as Vars, executed: [] }, state: { sent: 0, pendingStart: null } };
  }
  await persist(run, run.automation, business, resumed.outcome, resumed.state, 0);
}

export type DueResult = { resumed: number; closedStuck: number; closedSilent: number };

/** Continues every pause that ran out and tidies runs that can no longer move. Called by the scheduler. */
export async function runDueAutomations(opts: { limit?: number } = {}): Promise<DueResult> {
  const now = new Date();
  const stuck = await prisma.automationRun.updateMany({
    where: { status: "RUNNING", updatedAt: { lt: new Date(now.getTime() - STUCK_RUNNING_MS) } },
    data: { status: "FAILED", lastError: "Se interrumpió a la mitad.", finishedAt: now },
  });
  const silent = await prisma.automationRun.updateMany({
    where: { status: "WAITING_REPLY", updatedAt: { lt: new Date(now.getTime() - WAIT_REPLY_TTL_MS) } },
    data: { status: "STOPPED", lastError: "El cliente no respondió.", finishedAt: now },
  });
  const due = await prisma.automationRun.findMany({
    where: { status: "WAITING_TIME", resumeAt: { lte: now } },
    include: { automation: true },
    orderBy: { resumeAt: "asc" },
    take: opts.limit ?? 25,
  });
  let resumed = 0;
  for (const run of due) {
    try {
      await resumePause(run);
      resumed += 1;
    } catch (err) {
      console.error("[flows] resuming a pause failed:", err instanceof Error ? err.message : err);
    }
  }
  return { resumed, closedStuck: stuck.count, closedSilent: silent.count };
}

let lastOpportunisticRun = 0;

/** Same as runDueAutomations, but at most once a minute per server: for webhook deliveries, which already arrive often. */
export async function maybeRunDueAutomations(): Promise<void> {
  if (Date.now() - lastOpportunisticRun < 60_000) return;
  lastOpportunisticRun = Date.now();
  await runDueAutomations({ limit: 10 });
}
