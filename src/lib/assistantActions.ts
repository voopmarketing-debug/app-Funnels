"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin } from "@/lib/authz";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { accessibleBusinesses, contextNote, runAssistant } from "@/lib/assistant/run";
import { READ_TOOL_LABELS, isProposeTool, type ProposalPreview } from "@/lib/assistant/tools";
import { executeProposal } from "@/lib/assistant/apply";

// Server actions behind the Asistente Funnels chat (components/assistant).

type Message = Anthropic.Beta.BetaMessageParam;

const DAY_MS = 24 * 60 * 60 * 1000;
// Messages a person can send the assistant per day (each one is a few Claude calls).
const DAILY_LIMIT_AGENCY = 200;
const DAILY_LIMIT_CLIENT = 40;
const MAX_INPUT_CHARS = 4000;
const CONTEXT_PREFIX = "[Contexto de la plataforma:";
const PLATFORM_PREFIX = "[La plataforma:";

export type ChatAction = {
  id: string;
  status: "pending" | "applying" | "applied" | "discarded" | "failed";
  result: string | null;
  preview: ProposalPreview;
};

export type ChatItem =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "step"; label: string }
  | { type: "action"; action: ChatAction };

export type ChatView = { threadId: string; title: string; items: ChatItem[] };

async function userId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Inicia sesión de nuevo");
  return session.user.id;
}

function toChatItems(messages: Message[], actions: { id: string; toolUseId: string; status: string; result: string | null; payload: unknown }[]): ChatItem[] {
  const byToolUse = new Map(actions.map((a) => [a.toolUseId, a]));
  const items: ChatItem[] = [];
  for (const m of messages) {
    const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;
    for (const b of blocks) {
      if (m.role === "user" && b.type === "text") {
        if (b.text.startsWith(CONTEXT_PREFIX) || b.text.startsWith(PLATFORM_PREFIX)) continue;
        items.push({ type: "user", text: b.text });
      } else if (m.role === "assistant" && b.type === "text" && b.text.trim()) {
        items.push({ type: "assistant", text: b.text });
      } else if (m.role === "assistant" && b.type === "tool_use") {
        if (isProposeTool(b.name)) {
          const a = byToolUse.get(b.id);
          if (a) {
            const payload = a.payload as { preview: ProposalPreview };
            items.push({ type: "action", action: { id: a.id, status: a.status as ChatAction["status"], result: a.result, preview: payload.preview } });
          }
        } else {
          const label = READ_TOOL_LABELS[b.name] ?? "Revisé tu cuenta";
          // One chip per kind of lookup in a row is enough.
          const prev = items[items.length - 1];
          if (!(prev?.type === "step" && prev.label === label)) items.push({ type: "step", label });
        }
      }
    }
  }
  return items;
}

async function viewOf(threadId: string, uid: string): Promise<ChatView> {
  const thread = await prisma.assistantThread.findFirstOrThrow({
    where: { id: threadId, userId: uid },
    include: { actions: { select: { id: true, toolUseId: true, status: true, result: true, payload: true } } },
  });
  return { threadId: thread.id, title: thread.title, items: toChatItems(thread.messages as unknown as Message[], thread.actions) };
}

export async function sendAssistantMessage(input: {
  threadId: string | null;
  text: string;
  businessId: string | null;
  pageLabel: string | null;
}): Promise<{ ok: true; view: ChatView } | { ok: false; error: string; view?: ChatView }> {
  const uid = await userId();
  const text = input.text.trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return { ok: false, error: "Escribe qué necesitas" };

  const limitKey = `assistant:${uid}`;
  const limit = (await isAgencyAdmin(uid)) ? DAILY_LIMIT_AGENCY : DAILY_LIMIT_CLIENT;
  if (await isRateLimited(limitKey, limit, DAY_MS)) {
    return { ok: false, error: `Llegaste al límite de ${limit} mensajes al asistente por hoy. Mañana puedes seguir.` };
  }

  const businesses = await accessibleBusinesses(uid);
  const current = businesses.find((b) => b.id === input.businessId) ?? null;
  const thread = input.threadId
    ? await prisma.assistantThread.findFirst({ where: { id: input.threadId, userId: uid } })
    : await prisma.assistantThread.create({
        data: { userId: uid, businessId: current?.id ?? businesses[0]?.id ?? null, title: text.slice(0, 60), messages: [] },
      });
  if (!thread) return { ok: false, error: "Esta conversación ya no existe. Empieza una nueva." };

  const messages = thread.messages as unknown as Message[];
  messages.push({
    role: "user",
    content: [
      { type: "text", text: contextNote(businesses, current, input.pageLabel?.slice(0, 80) ?? null) },
      { type: "text", text },
    ],
  });
  await recordRateLimitEvent(limitKey);

  const before = messages.length;
  let error: string | null = null;
  try {
    await runAssistant({ threadId: thread.id, userId: uid, chargeBusinessId: thread.businessId, businesses, messages });
  } catch (err) {
    console.error("[assistant] run failed", err);
    error = "El asistente no pudo responder ahora. Intenta de nuevo en un momento.";
    // Keep the history valid for the next try: drop a half-finished tool round.
    while (messages.length > before && messages[messages.length - 1].role === "assistant") {
      const last = messages[messages.length - 1];
      if (typeof last.content !== "string" && last.content.some((b) => b.type === "tool_use")) messages.pop();
      else break;
    }
  }
  await prisma.assistantThread.update({ where: { id: thread.id }, data: { messages: messages as unknown as object[] } });
  const view = await viewOf(thread.id, uid);
  return error ? { ok: false, error, view } : { ok: true, view };
}

export async function getAssistantThread(threadId: string): Promise<ChatView | null> {
  const uid = await userId();
  const exists = await prisma.assistantThread.findFirst({ where: { id: threadId, userId: uid }, select: { id: true } });
  return exists ? viewOf(threadId, uid) : null;
}

export async function listAssistantThreads(): Promise<{ id: string; title: string; updatedAt: string }[]> {
  const uid = await userId();
  const rows = await prisma.assistantThread.findMany({ where: { userId: uid }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true, updatedAt: true } });
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() }));
}

/** "Aplicar": runs the proposal once, with the person's own permissions. */
export async function applyAssistantAction(actionId: string): Promise<ChatAction> {
  const uid = await userId();
  // Claim it first so a double tap can't apply it twice.
  const claimed = await prisma.assistantAction.updateMany({ where: { id: actionId, userId: uid, status: "pending" }, data: { status: "applying" } });
  const action = await prisma.assistantAction.findFirstOrThrow({ where: { id: actionId, userId: uid } });
  const preview = (action.payload as { preview: ProposalPreview }).preview;
  if (claimed.count === 0) return { id: action.id, status: action.status as ChatAction["status"], result: action.result, preview };
  if (!isProposeTool(action.kind)) throw new Error("Acción desconocida");

  let status: ChatAction["status"];
  let result: string;
  try {
    result = await executeProposal(action.kind, action.businessId, action.payload as Record<string, unknown>);
    status = "applied";
  } catch (err) {
    console.error("[assistant] apply failed", action.kind, err);
    const reason = err instanceof Error && err.message && !/^Not authenticated|Forbidden|Invalid/.test(err.message) ? err.message : "No tienes permiso para este cambio o algo falló.";
    result = `No se pudo aplicar: ${reason}`;
    // A broadcast may have sent part of its messages: never offer it again.
    status = action.kind === "propose_broadcast" ? "failed" : "pending";
  }
  await prisma.assistantAction.update({ where: { id: action.id }, data: { status, result, ...(status === "applied" ? { appliedAt: new Date() } : {}) } });
  if (status === "applied") await noteOnThread(action.threadId, `la persona aplicó «${preview.title}». ${result}`);
  return { id: action.id, status, result, preview };
}

export async function discardAssistantAction(actionId: string): Promise<ChatAction> {
  const uid = await userId();
  await prisma.assistantAction.updateMany({ where: { id: actionId, userId: uid, status: "pending" }, data: { status: "discarded" } });
  const action = await prisma.assistantAction.findFirstOrThrow({ where: { id: actionId, userId: uid } });
  const preview = (action.payload as { preview: ProposalPreview }).preview;
  if (action.status === "discarded") await noteOnThread(action.threadId, `la persona descartó «${preview.title}».`);
  return { id: action.id, status: action.status as ChatAction["status"], result: action.result, preview };
}

/** Tells Claude what happened to a proposal on its next turn (appended, never edited). */
async function noteOnThread(threadId: string, note: string): Promise<void> {
  const thread = await prisma.assistantThread.findUnique({ where: { id: threadId }, select: { messages: true } });
  if (!thread) return;
  const messages = thread.messages as unknown as Message[];
  messages.push({ role: "user", content: [{ type: "text", text: `${PLATFORM_PREFIX} ${note}]` }] });
  await prisma.assistantThread.update({ where: { id: threadId }, data: { messages: messages as unknown as object[] } });
}
