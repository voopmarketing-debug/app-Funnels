"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin } from "@/lib/authz";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { accessibleBusinesses, contextNote, runAssistant } from "@/lib/assistant/run";
import { READ_TOOL_LABELS, isProposeTool, type ProposalPreview } from "@/lib/assistant/tools";
import { executeProposal } from "@/lib/assistant/apply";
import { AGENCY_SCOPE, type ChatScope } from "@/lib/assistant/scope";

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

export type ChatView = { threadId: string; title: string; scope: ChatScope; items: ChatItem[] };

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
  return {
    threadId: thread.id,
    title: thread.title,
    scope: thread.businessId ?? AGENCY_SCOPE,
    items: toChatItems(thread.messages as unknown as Message[], thread.actions),
  };
}

/** Businesses the chat can switch between, and whether the agency mode is on offer. */
export async function getAssistantContext(): Promise<{ isAgency: boolean; businesses: { id: string; name: string }[] }> {
  const uid = await userId();
  const [isAgency, businesses] = await Promise.all([isAgencyAdmin(uid), accessibleBusinesses(uid)]);
  return { isAgency, businesses: businesses.map((b) => ({ id: b.id, name: b.name })) };
}

export async function sendAssistantMessage(input: {
  threadId: string | null;
  text: string;
  scope: ChatScope;
  pageLabel: string | null;
}): Promise<{ ok: true; view: ChatView } | { ok: false; error: string; view?: ChatView }> {
  const uid = await userId();
  const text = input.text.trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return { ok: false, error: "Escribe qué necesitas" };

  const isAgency = await isAgencyAdmin(uid);
  const limitKey = `assistant:${uid}`;
  const limit = isAgency ? DAILY_LIMIT_AGENCY : DAILY_LIMIT_CLIENT;
  if (await isRateLimited(limitKey, limit, DAY_MS)) {
    return { ok: false, error: `Llegaste al límite de ${limit} mensajes al asistente por hoy. Mañana puedes seguir.` };
  }

  const businesses = await accessibleBusinesses(uid);
  const existing = input.threadId ? await prisma.assistantThread.findFirst({ where: { id: input.threadId, userId: uid } }) : null;
  if (input.threadId && !existing) return { ok: false, error: "Esta conversación ya no existe. Empieza una nueva." };
  // A conversation keeps the scope it started with.
  const scope = existing ? (existing.businessId ?? AGENCY_SCOPE) : input.scope;
  const agencyMode = scope === AGENCY_SCOPE;
  const business = agencyMode ? null : (businesses.find((b) => b.id === scope) ?? null);
  if (agencyMode ? !isAgency : !business) return { ok: false, error: "Elige arriba el negocio con el que quieres trabajar." };

  // The agency's own line pays for agency-mode chats.
  const chargeBusinessId = business?.id ?? businesses.find((b) => b.role === "OWNER")?.id ?? businesses[0]?.id ?? null;
  const thread =
    existing ?? (await prisma.assistantThread.create({ data: { userId: uid, businessId: business?.id ?? null, title: text.slice(0, 60), messages: [] } }));

  const messages = thread.messages as unknown as Message[];
  messages.push({
    role: "user",
    content: [
      { type: "text", text: contextNote(business ? { business } : { agency: true, clients: businesses.length }, input.pageLabel?.slice(0, 80) ?? null) },
      { type: "text", text },
    ],
  });
  await recordRateLimitEvent(limitKey);

  const before = messages.length;
  let error: string | null = null;
  try {
    await runAssistant({
      threadId: thread.id,
      userId: uid,
      chargeBusinessId,
      scope: business ? { businesses: [business], agencyUserId: null } : { businesses, agencyUserId: uid },
      messages,
    });
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

export async function listAssistantThreads(): Promise<{ id: string; title: string; updatedAt: string; scopeLabel: string }[]> {
  const uid = await userId();
  const rows = await prisma.assistantThread.findMany({ where: { userId: uid }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true, updatedAt: true, businessId: true } });
  const names = new Map(
    (await prisma.business.findMany({ where: { id: { in: rows.map((r) => r.businessId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((b) => [b.id, b.name]),
  );
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString(), scopeLabel: r.businessId ? (names.get(r.businessId) ?? "Negocio") : "Mi agencia" }));
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
