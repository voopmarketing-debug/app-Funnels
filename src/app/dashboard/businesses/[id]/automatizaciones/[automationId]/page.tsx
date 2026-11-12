import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkTriggers, type Flow, type Trigger } from "@/lib/automations/flow";
import { ensureLayout } from "@/lib/automations/flowLayout";
import { canEditFlows } from "@/lib/flowAccess";
import { FlowEditor } from "./FlowEditor";
import { FlowStudio } from "./studio/FlowStudio";

const DEFAULT_FLOW: Flow = { start: "message_1", steps: { message_1: { id: "message_1", type: "message", text: "Hola [nombre del lead], ¿en qué te puedo ayudar?" } } };

/** A saved flow, or the starting one if what is stored can't be read as a flow at all. */
function readFlow(value: unknown): Flow {
  const flow = value as { start?: unknown; steps?: unknown } | null;
  if (flow && typeof flow.start === "string" && flow.steps && typeof flow.steps === "object" && !Array.isArray(flow.steps) && (flow.steps as Record<string, unknown>)[flow.start]) return flow as Flow;
  return DEFAULT_FLOW;
}

export default async function AutomationEditorPage({ params, searchParams }: { params: Promise<{ id: string; automationId: string }>; searchParams: Promise<{ editor?: string }> }) {
  const { id, automationId } = await params;
  const { editor } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: id } }, select: { role: true, canManageFlows: true } });
  if (!membership) notFound();
  const automation = await prisma.automation.findFirst({ where: { id: automationId, businessId: id } });
  if (!automation) notFound();

  const [stages, pipelines, templates, others, business] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { businessId: id }, orderBy: [{ pipeline: { position: "asc" } }, { position: "asc" }], select: { id: true, name: true, pipeline: { select: { name: true } } } }),
    prisma.pipeline.findMany({ where: { businessId: id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.messageTemplate.findMany({ where: { businessId: id, status: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.automation.findMany({ where: { businessId: id, NOT: { id: automationId } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.business.findUnique({ where: { id }, select: { wabaAccessToken: true, wabaPhoneNumberId: true } }),
  ]);

  const parsedTriggers = checkTriggers(automation.triggers);
  const triggers: Trigger[] = parsedTriggers.ok ? parsedTriggers.triggers : [];
  const editorData = { stages: stages.map((s) => ({ id: s.id, name: s.name, pipelineName: s.pipeline.name })), pipelines, templates, automations: others };
  const canEdit = canEditFlows(membership.role, membership.canManageFlows);
  const whatsappConnected = !!business?.wabaAccessToken && !!business.wabaPhoneNumberId;

  // The canvas editor (full screen, left to right) is the editor for everyone;
  // ?editor=anterior brings the previous one back.
  if (editor !== "anterior") {
    return (
      <FlowStudio
        businessId={id}
        automationId={automationId}
        initialName={automation.name}
        initialEnabled={automation.enabled}
        initialTriggers={triggers}
        initialFlow={ensureLayout(readFlow(automation.definition))}
        data={editorData}
        canEdit={canEdit}
        whatsappConnected={whatsappConnected}
        backHref={`/dashboard/businesses/${id}/automatizaciones`}
      />
    );
  }

  return (
    <FlowEditor
      businessId={id}
      automationId={automationId}
      initialName={automation.name}
      initialEnabled={automation.enabled}
      initialTriggers={triggers}
      initialFlow={readFlow(automation.definition)}
      data={editorData}
      canEdit={canEdit}
      whatsappConnected={whatsappConnected}
    />
  );
}
