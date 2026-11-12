import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkTriggers } from "@/lib/automations/flow";
import { triggerSummary } from "@/lib/automations/flowEdit";
import { canEditFlows } from "@/lib/flowAccess";
import { AutomationList, type AutomationRow } from "./AutomationList";

export const metadata = { title: "Automatizaciones" };

export default async function AutomationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaAccessToken: true, wabaPhoneNumberId: true } } },
  });
  if (!membership) notFound();

  const [automations, active, stages] = await Promise.all([
    prisma.automation.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" } }),
    prisma.automationRun.groupBy({ by: ["automationId"], where: { businessId: id, status: { in: ["RUNNING", "WAITING_REPLY", "WAITING_TIME"] } }, _count: { _all: true } }),
    prisma.pipelineStage.findMany({ where: { businessId: id }, select: { id: true, name: true } }),
  ]);
  const activeBy = new Map(active.map((a) => [a.automationId, a._count._all]));
  const stageName = (stageId: string) => stages.find((s) => s.id === stageId)?.name ?? null;

  const rows: AutomationRow[] = automations.map((a) => {
    const triggers = checkTriggers(a.triggers);
    return {
      id: a.id,
      name: a.name,
      enabled: a.enabled,
      triggers: triggers.ok ? triggers.triggers.map((t) => triggerSummary(t, stageName)) : [],
      launches: a.launches,
      completed: a.completed,
      active: activeBy.get(a.id) ?? 0,
    };
  });

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-3">
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Automatizaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">Conversaciones de WhatsApp que se arman solas: mensajes, botones, preguntas, etiquetas y cambios de etapa, según lo que haga cada cliente.</p>
        </div>
      </header>
      <AutomationList businessId={id} rows={rows} canEdit={canEditFlows(membership.role, membership.canManageFlows)} whatsappConnected={!!membership.business.wabaAccessToken && !!membership.business.wabaPhoneNumberId} />
    </div>
  );
}
