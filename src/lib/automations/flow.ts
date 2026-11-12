import { z } from "zod";

// What a conversation flow (Salesbot) is made of: what starts it (triggers)
// and the steps it follows (definition). Everything a user can build is
// described here and checked before it is saved, so the engine only ever
// runs flows that make sense. Steps point at the next one by id; a missing
// `next` ends the flow.

export const MAX_STEPS = 60;
/** The longest a "Pausa" can wait. */
export const MAX_PAUSE_MS = 30 * 24 * 60 * 60 * 1000;

const Id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Solo letras, números, guion y guion bajo");
const Next = Id.nullish();
const Text = (max: number) => z.string().trim().min(1).max(max);

// ---- Triggers ----

export const TriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("new_conversation") }),
  z.object({ type: z.literal("message"), keywords: z.array(Text(60)).min(1).max(20), match: z.enum(["contains", "exact"]).optional() }),
  z.object({ type: z.literal("stage_changed"), stageId: Id }),
  z.object({ type: z.literal("tag_added"), tag: Text(40) }),
  z.object({ type: z.literal("appointment_booked") }),
]);
export type Trigger = z.infer<typeof TriggerSchema>;

// ---- Steps ----

const Button = z.object({ id: Id, title: Text(20), next: Next });
const Row = z.object({ id: Id, title: Text(24), description: z.string().trim().max(72).optional(), next: Next });
const Outcome = z.object({ id: Id, label: Text(60), next: Next });

export const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move_stage"), stageId: Id }),
  z.object({ kind: z.literal("add_tag"), tag: Text(40) }),
  z.object({ kind: z.literal("remove_tag"), tag: Text(40) }),
  z.object({ kind: z.literal("set_field"), field: z.enum(["name", "email", "notes"]), value: Text(500) }),
  z.object({ kind: z.literal("pause_ai") }),
  z.object({ kind: z.literal("resume_ai") }),
]);
export type Action = z.infer<typeof ActionSchema>;

const HasOps = z.enum(["exists", "missing"]);
export const RuleSchema = z.union([
  z.object({ field: z.literal("tag"), op: z.enum(["has", "has_not"]), value: Text(40) }),
  z.object({ field: z.literal("stage"), op: z.enum(["is", "is_not"]), value: Id }),
  z.object({ field: z.literal("message"), op: z.enum(["contains", "not_contains", "equals"]), value: Text(100) }),
  z.object({ field: z.literal("hour"), op: z.enum(["gte", "lte"]), value: z.number().int().min(0).max(23) }),
  z.object({ field: z.literal("appointment"), op: HasOps }),
  z.object({ field: z.literal("email"), op: HasOps }),
  z.object({ field: z.literal("name"), op: HasOps }),
]);
export type Rule = z.infer<typeof RuleSchema>;

export const VALIDATION_KINDS = ["email", "phone", "number", "date", "text"] as const;
export const SAVE_TO = ["name", "email", "notes"] as const;

export const StepSchema = z.discriminatedUnion("type", [
  z.object({
    id: Id,
    type: z.literal("message"),
    text: Text(1000),
    /** Up to 3 reply buttons: the flow waits and follows the one tapped. */
    buttons: z.array(Button).max(3).optional(),
    waitForReply: z.boolean().optional(),
    /** The approved template to use when the 24 h window is closed. */
    templateId: z.string().max(40).optional(),
    mediaUrl: z.string().url().max(2000).optional(),
    mediaType: z.enum(["image", "document", "video"]).optional(),
    next: Next,
  }),
  z.object({ id: Id, type: z.literal("reaction"), emoji: Text(8), next: Next }),
  z.object({ id: Id, type: z.literal("comment"), text: Text(1000), next: Next }),
  z.object({ id: Id, type: z.literal("internal"), text: Text(500), next: Next }),
  z.object({
    id: Id,
    type: z.literal("list"),
    text: Text(1000),
    buttonText: Text(20),
    rows: z.array(Row).min(1).max(10),
    /** Where to go when the reply is not one of the rows (after one retry). */
    otherwise: Next,
  }),
  z.object({ id: Id, type: z.literal("ai_condition"), question: Text(300), outcomes: z.array(Outcome).min(2).max(6), otherwise: Next }),
  z.object({ id: Id, type: z.literal("pause"), amount: z.number().int().min(1), unit: z.enum(["minutes", "hours", "days"]), next: Next }),
  z.object({ id: Id, type: z.literal("actions"), actions: z.array(ActionSchema).min(1).max(8), next: Next }),
  z.object({ id: Id, type: z.literal("condition"), match: z.enum(["all", "any"]), rules: z.array(RuleSchema).min(1).max(6), yes: Next, no: Next }),
  z.object({
    id: Id,
    type: z.literal("validation"),
    kind: z.enum(VALIDATION_KINDS),
    prompt: Text(500),
    retryPrompt: z.string().trim().max(500).optional(),
    maxRetries: z.number().int().min(0).max(5).optional(),
    saveTo: z.enum(SAVE_TO).optional(),
    ok: Next,
    fail: Next,
  }),
  z.object({ id: Id, type: z.literal("goto"), target: Id }),
  z.object({ id: Id, type: z.literal("start_flow"), automationId: z.string().min(1).max(40) }),
  z.object({ id: Id, type: z.literal("http"), url: z.string().url().max(2000), method: z.enum(["GET", "POST"]).optional(), next: Next }),
  z.object({ id: Id, type: z.literal("round_robin"), pipelineIds: z.array(Id).min(2).max(10), next: Next }),
  z.object({ id: Id, type: z.literal("stop") }),
]);
export type Step = z.infer<typeof StepSchema>;
export type StepType = Step["type"];

/** Where a step's card sits on the editor's canvas. The engine never reads it. */
export const PositionSchema = z.object({ x: z.number().min(-100_000).max(100_000), y: z.number().min(-100_000).max(100_000) });
export type Position = z.infer<typeof PositionSchema>;

export const FlowSchema = z.object({ start: Id, steps: z.record(Id, StepSchema), layout: z.record(Id, PositionSchema).optional() });
export type Flow = z.infer<typeof FlowSchema>;

export const STEP_LABELS: Record<StepType, string> = {
  message: "Mensaje",
  reaction: "Reacción",
  comment: "Comentario",
  internal: "Enviar mensaje interno",
  list: "Mensaje de lista (WhatsApp)",
  ai_condition: "Condición de IA",
  pause: "Pausa",
  actions: "Acciones",
  condition: "Condición",
  validation: "Validación",
  goto: "Ir a otro paso",
  start_flow: "Iniciar otro flujo",
  http: "Enviar a una URL",
  round_robin: "Round Robin",
  stop: "Parar flujo",
};

export function pauseMs(step: { amount: number; unit: "minutes" | "hours" | "days" }): number {
  const unit = step.unit === "minutes" ? 60_000 : step.unit === "hours" ? 3_600_000 : 86_400_000;
  return step.amount * unit;
}

/** Every step id a step can lead to. */
export function nextIds(step: Step): string[] {
  const ids: (string | null | undefined)[] = [];
  switch (step.type) {
    case "message":
      ids.push(step.next, ...(step.buttons ?? []).map((b) => b.next));
      break;
    case "list":
      ids.push(step.otherwise, ...step.rows.map((r) => r.next));
      break;
    case "ai_condition":
      ids.push(step.otherwise, ...step.outcomes.map((o) => o.next));
      break;
    case "condition":
      ids.push(step.yes, step.no);
      break;
    case "validation":
      ids.push(step.ok, step.fail);
      break;
    case "goto":
      ids.push(step.target);
      break;
    case "stop":
    case "start_flow":
      break;
    default:
      ids.push(step.next);
  }
  return ids.filter((x): x is string => !!x);
}

export type FlowCheck = { ok: true; flow: Flow; unreachable: string[] } | { ok: false; errors: string[] };

const dup = (ids: string[]) => ids.find((id, i) => ids.indexOf(id) !== i);

/** Parses a saved flow and checks what the schema can't: that every arrow lands on a real step and nothing is contradictory. */
export function checkFlow(input: unknown): FlowCheck {
  const parsed = FlowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "flujo"}: ${i.message}`) };
  }
  const flow = parsed.data;
  const errors: string[] = [];
  const ids = Object.keys(flow.steps);
  if (ids.length > MAX_STEPS) errors.push(`El flujo tiene ${ids.length} pasos y el máximo es ${MAX_STEPS}.`);
  if (!flow.steps[flow.start]) errors.push("El paso de inicio no existe.");

  for (const [key, step] of Object.entries(flow.steps)) {
    const where = `Paso «${key}» (${STEP_LABELS[step.type]})`;
    if (step.id !== key) errors.push(`${where}: su identificador no coincide con el del flujo.`);
    for (const target of nextIds(step)) {
      if (!flow.steps[target]) errors.push(`${where}: apunta al paso «${target}», que no existe.`);
    }
    if (step.type === "message") {
      if (step.buttons?.length && step.mediaUrl) errors.push(`${where}: no puede llevar botones y un archivo a la vez.`);
      if (step.mediaUrl && !step.mediaType) errors.push(`${where}: falta decir qué tipo de archivo es.`);
      if (dup((step.buttons ?? []).map((b) => b.id))) errors.push(`${where}: dos botones tienen el mismo identificador.`);
      if (dup((step.buttons ?? []).map((b) => b.title.toLowerCase()))) errors.push(`${where}: dos botones tienen el mismo texto.`);
    }
    if (step.type === "list") {
      if (dup(step.rows.map((r) => r.id))) errors.push(`${where}: dos opciones tienen el mismo identificador.`);
      if (dup(step.rows.map((r) => r.title.toLowerCase()))) errors.push(`${where}: dos opciones tienen el mismo texto.`);
    }
    if (step.type === "ai_condition" && dup(step.outcomes.map((o) => o.id))) errors.push(`${where}: dos resultados tienen el mismo identificador.`);
    if (step.type === "pause" && pauseMs(step) > MAX_PAUSE_MS) errors.push(`${where}: la espera máxima es de 30 días.`);
    if (step.type === "http" && !step.url.startsWith("https://")) errors.push(`${where}: la dirección debe empezar con https://.`);
    if (step.type === "round_robin" && dup(step.pipelineIds)) errors.push(`${where}: repetiste un embudo.`);
    if (step.type === "goto" && step.target === key) errors.push(`${where}: salta a sí mismo y nunca terminaría.`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const seen = new Set<string>();
  const queue = [flow.start];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...nextIds(flow.steps[id]));
  }
  return { ok: true, flow, unreachable: ids.filter((id) => !seen.has(id)) };
}

export function checkTriggers(input: unknown): { ok: true; triggers: Trigger[] } | { ok: false; errors: string[] } {
  const parsed = z.array(TriggerSchema).max(10).safeParse(input);
  return parsed.success ? { ok: true, triggers: parsed.data } : { ok: false, errors: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "disparadores"}: ${i.message}`) };
}
