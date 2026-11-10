import { STEP_LABELS, type Flow, type Trigger } from "./flow";

// A flow points at things that live elsewhere in the business: stages,
// funnels, templates, other flows. Before one is enabled (or saved), each
// of those must belong to THIS business: ids come from the browser, so they
// are never trusted, and an id from another business must not work.

export type KnownIds = {
  stages: Set<string>;
  pipelines: Set<string>;
  /** Approved templates only. */
  templates: Set<string>;
  automations: Set<string>;
};

export function referenceErrors(flow: Flow, triggers: Trigger[], known: KnownIds, selfId: string): string[] {
  const errors: string[] = [];
  for (const trigger of triggers) {
    if (trigger.type === "stage_changed" && !known.stages.has(trigger.stageId)) errors.push("El disparador «cambia de etapa» apunta a una etapa que no existe.");
  }
  for (const step of Object.values(flow.steps)) {
    const where = `Paso «${step.id}» (${STEP_LABELS[step.type]})`;
    if (step.type === "message" || step.type === "list") {
      const templateId = step.type === "message" ? step.templateId : undefined;
      if (templateId && !known.templates.has(templateId)) errors.push(`${where}: la plantilla elegida no existe o no está aprobada.`);
    }
    if (step.type === "actions") {
      for (const action of step.actions) if (action.kind === "move_stage" && !known.stages.has(action.stageId)) errors.push(`${where}: una etapa elegida ya no existe.`);
    }
    if (step.type === "condition") {
      for (const rule of step.rules) if (rule.field === "stage" && !known.stages.has(rule.value)) errors.push(`${where}: una etapa elegida ya no existe.`);
    }
    if (step.type === "round_robin") {
      for (const id of step.pipelineIds) if (!known.pipelines.has(id)) errors.push(`${where}: un embudo elegido ya no existe.`);
    }
    if (step.type === "start_flow") {
      if (step.automationId === selfId) errors.push(`${where}: un flujo no puede iniciarse a sí mismo.`);
      else if (!known.automations.has(step.automationId)) errors.push(`${where}: el flujo elegido ya no existe.`);
    }
  }
  return [...new Set(errors)];
}
