import type { Flow, Step } from "./flow";
import { TERMINAL_TYPES } from "./flowEdit";

// What is still missing in a step, in the words of the editor. The schema
// (flow.ts) decides whether a flow may run; this says what to fix, step by
// step, while it is being built.

const blank = (s: string | undefined) => !s || !s.trim();

export function stepIssues(step: Step, flow: Flow): string[] {
  const out: string[] = [];
  switch (step.type) {
    case "message":
      if (blank(step.text)) out.push("Escribe el mensaje.");
      for (const b of step.buttons ?? []) {
        if (blank(b.title)) out.push("Un botón no tiene texto.");
        else if (b.title.length > 20) out.push(`El botón «${b.title}» tiene más de 20 letras (WhatsApp no lo permite).`);
      }
      if (step.text.length > 1000) out.push("El mensaje es demasiado largo (máximo 1.000 letras).");
      break;
    case "reaction":
      if (blank(step.emoji)) out.push("Elige el emoji de la reacción.");
      break;
    case "comment":
    case "internal":
      if (blank(step.text)) out.push("Escribe el texto.");
      break;
    case "list":
      if (blank(step.text)) out.push("Escribe el mensaje que acompaña al menú.");
      if (blank(step.buttonText)) out.push("Escribe el texto del botón que abre el menú.");
      if (step.rows.some((r) => blank(r.title))) out.push("Una opción del menú no tiene texto.");
      if (step.rows.some((r) => r.title.length > 24)) out.push("Una opción del menú tiene más de 24 letras (WhatsApp no lo permite).");
      break;
    case "ai_condition":
      if (blank(step.question)) out.push("Escribe la pregunta que debe responder la IA.");
      if (step.outcomes.some((o) => blank(o.label))) out.push("Un resultado no tiene descripción.");
      break;
    case "pause":
      if (!Number.isInteger(step.amount) || step.amount < 1) out.push("La espera debe ser de al menos 1.");
      break;
    case "actions":
      if (step.actions.length === 0) out.push("Agrega al menos una acción.");
      for (const a of step.actions) {
        if (a.kind === "move_stage" && blank(a.stageId)) out.push("Elige la etapa a la que se mueve el lead.");
        if ((a.kind === "add_tag" || a.kind === "remove_tag") && blank(a.tag)) out.push("Escribe la etiqueta.");
        if (a.kind === "set_field" && blank(a.value)) out.push("Escribe el valor que se guarda.");
      }
      break;
    case "condition":
      if (step.rules.length === 0) out.push("Agrega al menos una regla.");
      for (const r of step.rules) {
        if ("value" in r && (r.value === "" || r.value === undefined || r.value === null)) out.push("Una regla no tiene valor.");
      }
      break;
    case "validation":
      if (blank(step.prompt)) out.push("Escribe la pregunta que se le hace al cliente.");
      break;
    case "goto":
      if (!flow.steps[step.target]) out.push("Elige a qué paso salta.");
      else if (step.target === step.id) out.push("No puede saltar a sí mismo.");
      break;
    case "start_flow":
      if (blank(step.automationId)) out.push("Elige el flujo que se inicia.");
      break;
    case "http":
      if (!step.url.startsWith("https://") || step.url.length < 12) out.push("Escribe la dirección completa, empezando con https://.");
      break;
    case "round_robin":
      if (step.pipelineIds.length < 2) out.push("Elige al menos dos embudos para repartir los leads.");
      break;
    case "stop":
      break;
  }
  // Two empty buttons would otherwise say the same thing twice.
  return [...new Set(out)];
}

/** Every step with something missing, by id. */
export function flowIssues(flow: Flow): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const step of Object.values(flow.steps)) {
    const issues = stepIssues(step, flow);
    if (issues.length > 0) out[step.id] = issues;
  }
  return out;
}

/** Whether another step may come after this one. */
export const canContinue = (step: Step) => !TERMINAL_TYPES.includes(step.type);
