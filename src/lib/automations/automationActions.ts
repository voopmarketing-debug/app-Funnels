"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveAccount, requireFlowEditor } from "@/lib/authz";
import { checkFlow, checkTriggers, MAX_STEPS, type Flow, type Trigger } from "./flow";
import { referenceErrors, type KnownIds } from "./references";

// Creating, saving, switching on, copying and deleting flows. A flow sends
// WhatsApp messages by itself, so only the owner or the agency can change one.
// Everything the browser sends is checked again here.

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_AUTOMATIONS = 30;
const MAX_NAME = 80;
const MAX_DEFINITION_BYTES = 300_000;

const path = (businessId: string) => `/dashboard/businesses/${businessId}/automatizaciones`;

async function guard(businessId: string, opts: { active?: boolean } = {}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    await requireFlowEditor(session.user.id, businessId);
    // Turning a flow on spends WhatsApp messages: it needs an account in good standing.
    if (opts.active) await requireActiveAccount(session.user.id, businessId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No tienes permiso para hacer esto" };
  }
  return { ok: true, userId: session.user.id };
}

async function knownIds(businessId: string): Promise<KnownIds> {
  const [stages, pipelines, templates, automations] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { businessId }, select: { id: true } }),
    prisma.pipeline.findMany({ where: { businessId }, select: { id: true } }),
    prisma.messageTemplate.findMany({ where: { businessId, status: "APPROVED" }, select: { id: true } }),
    prisma.automation.findMany({ where: { businessId }, select: { id: true } }),
  ]);
  return {
    stages: new Set(stages.map((s) => s.id)),
    pipelines: new Set(pipelines.map((p) => p.id)),
    templates: new Set(templates.map((t) => t.id)),
    automations: new Set(automations.map((a) => a.id)),
  };
}

/** What stops a flow from being switched on: an incomplete step, a broken arrow, a reference outside the business, no trigger. */
async function flowProblems(businessId: string, selfId: string, triggers: unknown, definition: unknown): Promise<string[]> {
  const t = checkTriggers(triggers);
  const f = checkFlow(definition);
  const problems: string[] = [];
  if (!t.ok) problems.push(...t.errors);
  else if (t.triggers.length === 0) problems.push("Agrega al menos un disparador: qué hace que el flujo empiece.");
  if (!f.ok) problems.push(...f.errors);
  if (t.ok && f.ok) problems.push(...referenceErrors(f.flow, t.triggers, await knownIds(businessId), selfId));
  return problems;
}

const cleanName = (name: unknown) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME) : "");

function firstFlow(): Flow {
  return { start: "message_1", steps: { message_1: { id: "message_1", type: "message", text: "Hola [nombre del lead], ¿en qué te puedo ayudar?" } } };
}

export async function createAutomation(businessId: string, name: string): Promise<Result<{ id: string }>> {
  const allowed = await guard(businessId);
  if (!allowed.ok) return allowed;
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "Ponle un nombre al flujo." };
  if ((await prisma.automation.count({ where: { businessId } })) >= MAX_AUTOMATIONS) return { ok: false, error: `Llegaste al máximo de ${MAX_AUTOMATIONS} flujos. Borra alguno que ya no uses.` };
  const created = await prisma.automation.create({
    data: { businessId, name: clean, enabled: false, triggers: [{ type: "new_conversation" }] satisfies Trigger[], definition: firstFlow() as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(path(businessId));
  return { ok: true, id: created.id };
}

/** Whether `input` has the shape of a flow at all (a draft may still be incomplete, but it must be a flow). */
function looksLikeFlow(input: unknown): input is Flow {
  if (!input || typeof input !== "object") return false;
  const flow = input as { start?: unknown; steps?: unknown };
  return typeof flow.start === "string" && !!flow.steps && typeof flow.steps === "object" && !Array.isArray(flow.steps);
}

/**
 * Saves a flow as a draft: it may be incomplete while it is being built. A flow
 * that is on and is saved incomplete is switched off, so a half-edited flow
 * never runs. Returns what is still missing.
 */
export async function saveAutomation(businessId: string, id: string, input: { name: string; triggers: unknown; definition: unknown }): Promise<Result<{ enabled: boolean; problems: string[] }>> {
  const allowed = await guard(businessId);
  if (!allowed.ok) return allowed;
  const automation = await prisma.automation.findFirst({ where: { id, businessId } });
  if (!automation) return { ok: false, error: "Este flujo ya no existe." };

  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Ponle un nombre al flujo." };
  const triggers = checkTriggers(input.triggers);
  if (!triggers.ok) return { ok: false, error: `Revisa los disparadores: ${triggers.errors[0]}` };
  if (!looksLikeFlow(input.definition)) return { ok: false, error: "El flujo no tiene el formato correcto." };
  if (Object.keys(input.definition.steps).length > MAX_STEPS) return { ok: false, error: `Un flujo puede tener hasta ${MAX_STEPS} pasos.` };
  if (JSON.stringify(input.definition).length > MAX_DEFINITION_BYTES) return { ok: false, error: "El flujo es demasiado grande." };

  const problems = await flowProblems(businessId, id, triggers.triggers, input.definition);
  const stillOn = automation.enabled && problems.length === 0;
  await prisma.automation.update({
    where: { id },
    data: { name, triggers: triggers.triggers as unknown as Prisma.InputJsonValue, definition: input.definition as unknown as Prisma.InputJsonValue, enabled: stillOn },
  });
  revalidatePath(path(businessId));
  return { ok: true, enabled: stillOn, problems };
}

export async function setAutomationEnabled(businessId: string, id: string, enabled: boolean): Promise<Result<{ problems: string[] }>> {
  const allowed = await guard(businessId, { active: enabled });
  if (!allowed.ok) return allowed;
  const automation = await prisma.automation.findFirst({ where: { id, businessId } });
  if (!automation) return { ok: false, error: "Este flujo ya no existe." };
  if (enabled) {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { wabaAccessToken: true, wabaPhoneNumberId: true } });
    if (!business?.wabaAccessToken || !business.wabaPhoneNumberId) return { ok: false, error: "Conecta tu WhatsApp antes de activar un flujo: sin él no hay a dónde enviar los mensajes." };
    const problems = await flowProblems(businessId, id, automation.triggers, automation.definition);
    if (problems.length > 0) return { ok: false, error: `Todavía le falta algo: ${problems[0]}` };
  }
  await prisma.automation.update({ where: { id }, data: { enabled } });
  revalidatePath(path(businessId));
  return { ok: true, problems: [] };
}

export async function duplicateAutomation(businessId: string, id: string): Promise<Result<{ id: string }>> {
  const allowed = await guard(businessId);
  if (!allowed.ok) return allowed;
  const source = await prisma.automation.findFirst({ where: { id, businessId } });
  if (!source) return { ok: false, error: "Este flujo ya no existe." };
  if ((await prisma.automation.count({ where: { businessId } })) >= MAX_AUTOMATIONS) return { ok: false, error: `Llegaste al máximo de ${MAX_AUTOMATIONS} flujos.` };
  const copy = await prisma.automation.create({
    data: {
      businessId,
      name: `${source.name} (copia)`.slice(0, MAX_NAME),
      enabled: false,
      triggers: source.triggers as Prisma.InputJsonValue,
      definition: source.definition as Prisma.InputJsonValue,
    },
  });
  revalidatePath(path(businessId));
  return { ok: true, id: copy.id };
}

export async function deleteAutomation(businessId: string, id: string): Promise<Result> {
  const allowed = await guard(businessId);
  if (!allowed.ok) return allowed;
  const removed = await prisma.automation.deleteMany({ where: { id, businessId } });
  if (removed.count === 0) return { ok: false, error: "Este flujo ya no existe." };
  revalidatePath(path(businessId));
  return { ok: true };
}
