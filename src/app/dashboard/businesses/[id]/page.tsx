import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, getActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS, planUsageStatus } from "@/lib/plans";
import { AgentForm } from "./AgentForm";
import { WabaCredentialsForm } from "./WabaCredentialsForm";
import { AgentMediaManager } from "./AgentMediaManager";
import { AgentPowerButton } from "./AgentPowerButton";
import { PlanUsageCard } from "./PlanUsageCard";
import { StatTile } from "./analytics/StatTile";
import { ChatIcon, ClockIcon, BoltIcon, HourglassIcon } from "./analytics/StatIcons";

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "<1 min";
  return value < 10 ? `${value.toFixed(1)} min` : `${Math.round(value)} min`;
}

// Same thresholds as analytics/page.tsx's stat tiles — kept in sync so this
// compact row and the full KPI page always agree on what "bien"/"atención"/
// "crítico" mean for the same metric.
type Status = "good" | "warning" | "critical" | "neutral";

function automationStatus(rate: number | null): Status {
  if (rate === null) return "neutral";
  if (rate >= 80) return "good";
  if (rate >= 50) return "warning";
  return "critical";
}

function responseTimeStatus(minutes: number | null): Status {
  if (minutes === null) return "neutral";
  if (minutes <= 5) return "good";
  if (minutes <= 30) return "warning";
  return "critical";
}

function awaitingReplyStatus(count: number): Status {
  if (count === 0) return "good";
  if (count <= 3) return "warning";
  return "critical";
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

  const [analytics, activeContacts, agentMedia] = await Promise.all([
    getBusinessAnalytics(id),
    getActiveContactsThisMonth(id),
    prisma.agentMedia.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, mediaType: true, filename: true, sizeBytes: true, url: true },
    }),
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
            href={`/dashboard/businesses/${id}/crm`}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Ver CRM
          </Link>
          <Link
            href={`/dashboard/businesses/${id}/analytics`}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Ver KPIs
          </Link>
          <Link
            href={`/dashboard/businesses/${id}/templates`}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Plantillas
          </Link>
          <Link
            href={`/dashboard/businesses/${id}/website`}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Sitio web
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
        <StatTile
          label="Contactos totales"
          value={String(analytics.totalConversations)}
          description="Cuántas personas distintas te han escrito por WhatsApp en total, desde siempre."
          tone="accent"
          icon={<ChatIcon />}
        />
        <StatTile
          label="Tiempo de respuesta"
          value={formatMinutes(analytics.responseTime.avgMinutes)}
          status={responseTimeStatus(analytics.responseTime.avgMinutes)}
          description="En promedio, cuánto tarda en llegar una respuesta después de que un cliente escribe. Entre menos, mejor experiencia para el cliente."
          tone="amber"
          icon={<ClockIcon />}
        />
        <StatTile
          label="Automatización IA"
          value={formatPercent(analytics.automationRate)}
          sublabel="de respuestas sin humano"
          status={automationStatus(analytics.automationRate)}
          description="De cada 100 respuestas enviadas, cuántas las contestó la IA sola, sin que nadie de tu equipo interviniera a mano."
          tone="secondary"
          icon={<BoltIcon />}
        />
        <StatTile
          label="Esperando respuesta"
          value={String(analytics.awaitingReply)}
          sublabel="conversaciones sin contestar"
          status={awaitingReplyStatus(analytics.awaitingReply)}
          description="Conversaciones donde el cliente escribió último y todavía nadie —ni la IA ni una persona— le ha contestado."
          tone="blue"
          icon={<HourglassIcon />}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AgentForm
          businessId={id}
          systemPrompt={business.agent?.systemPrompt ?? ""}
          tone={business.agent?.tone ?? "cercano"}
          replyLength={business.agent?.replyLength ?? "breve"}
          industry={business.industry}
        />

        <WabaCredentialsForm
          businessId={id}
          wabaPhoneNumberId={business.wabaPhoneNumberId ?? ""}
          wabaId={business.wabaId ?? ""}
        />

        <AgentMediaManager businessId={id} media={agentMedia} />
      </div>
    </div>
  );
}
