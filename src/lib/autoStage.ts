import { isWonStageName } from "@/lib/sales";

// The AI agent moves each lead through its funnel as the chat progresses
// (see the move_lead_stage tool in lib/ai.ts). These rules keep it from
// fighting the team: it only moves leads forward, never out of a won stage,
// and only within the funnel the lead is already in, so a stage a person
// set by hand is never undone by the AI.

export type FunnelStage = { id: string; name: string; position: number };

export function isLostStageName(name: string): boolean {
  return /perdid|descartad|no interesad|cancelad/i.test(name);
}

// A stage meant for leads who booked a call, visit or session.
const BOOKED_STAGE = /agend|cita|reserv|demo|reuni|visita/i;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The stage to move the lead to when the AI asks for `targetName`, or null
 * when the move isn't allowed: an unknown stage, the stage it's already
 * in, backwards, or out of a won stage. A lead in a lost stage who comes
 * back can be moved to any stage that isn't lost (they re-engaged).
 */
export function resolveAutoStageMove(stages: FunnelStage[], currentStageId: string, targetName: string): FunnelStage | null {
  const current = stages.find((s) => s.id === currentStageId);
  const target = stages.find((s) => norm(s.name) === norm(targetName));
  if (!current || !target || target.id === current.id) return null;
  if (isWonStageName(current.name)) return null;
  if (isLostStageName(current.name)) return isLostStageName(target.name) ? null : target;
  // A lead can be lost from any stage; anything else only moves forward.
  if (isLostStageName(target.name)) return target;
  return target.position > current.position ? target : null;
}

/** The "Agendado"-type stage to move a lead to when the AI books an appointment, if the funnel has one ahead. */
export function bookedStageAfter(stages: FunnelStage[], currentStageId: string): FunnelStage | null {
  const booked = stages.find((s) => BOOKED_STAGE.test(s.name) && !isWonStageName(s.name) && !isLostStageName(s.name));
  return booked ? resolveAutoStageMove(stages, currentStageId, booked.name) : null;
}
