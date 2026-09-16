import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, getActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS, planUsageStatus } from "@/lib/plans";
import { AgentForm } from "./AgentForm";
import { WabaCredentialsForm } from "./WabaCredentialsForm";
import { ContactsView } from "./ContactsView";
import { AgentPowerButton } from "./AgentPowerButton";
import { PipelineManager } from "./PipelineManager";
import { PlanUsageCard } from "./PlanUsageCard";

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "<1 min";
  return value < 10 ? `${value.toFixed(1)} min` : `${Math.round(value)} min`;
}

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { include: { agent: true } } },
  });

  if (!membership) notFound();
  const { business } = membership;

  const [conversations, stages, analytics, activeContacts] = await Promise.all([
    prisma.conversation.findMany({
      where: { businessId: id },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.pipelineStage.findMany({
      where: { businessId: id },
      orderBy: { position: "asc" },
    }),
    getBusinessAnalytics(id),
    getActiveContactsThisMonth(id),
  ]);

  const planLimit = PLAN_LIMITS[business.planTier];
  const planStatus = planUsageStatus(activeContacts, planLimit);
  const canEditPlan = membership.role === "ADMIN";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{business.name}</h1>
          <p className="fl-mono text-xs tracking-wide text-ink-muted">
            WhatsApp: {business.wabaPhoneNumberId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/businesses/${id}/analytics`}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Ver KPIs
          </Link>
          <AgentPowerButton businessId={id} enabled={business.agent?.enabled ?? true} />
        </div>
      </div>

      <PlanUsageCard
        businessId={id}
        planTier={business.planTier}
        used={activeContacts}
        limit={planLimit}
        status={planStatus}
        canEditPlan={canEditPlan}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="fl-card p-4">
          <p className="text-xs text-ink-muted">Contactos totales</p>
          <p className="mt-1 text-2xl font-bold text-ink">{analytics.totalConversations}</p>
        </div>
        <div className="fl-card p-4">
          <p className="text-xs text-ink-muted">Tiempo de respuesta</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatMinutes(analytics.responseTime.avgMinutes)}</p>
        </div>
        <div className="fl-card p-4">
          <p className="text-xs text-ink-muted">Automatización IA</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatPercent(analytics.automationRate)}</p>
        </div>
        <div className="fl-card p-4">
          <p className="text-xs text-ink-muted">Esperando respuesta</p>
          <p className="mt-1 text-2xl font-bold text-ink">{analytics.awaitingReply}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="fl-card p-4">
          <AgentForm
            businessId={id}
            systemPrompt={business.agent?.systemPrompt ?? ""}
            tone={business.agent?.tone ?? "cercano"}
            replyLength={business.agent?.replyLength ?? "breve"}
            industry={business.industry}
          />
        </div>

        <WabaCredentialsForm businessId={id} wabaPhoneNumberId={business.wabaPhoneNumberId ?? ""} />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Contactos y CRM</h2>
        </div>

        <PipelineManager businessId={id} stages={stages} />

        {conversations.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Aún no hay conversaciones en WhatsApp para este negocio.
          </p>
        ) : (
          <ContactsView
            businessId={id}
            stages={stages}
            conversations={conversations.map((c) => ({
              id: c.id,
              customerName: c.customerName,
              customerPhone: c.customerPhone,
              stageId: c.stageId,
              lastMessageAt: c.lastMessageAt.toISOString(),
            }))}
          />
        )}
      </section>
    </div>
  );
}
