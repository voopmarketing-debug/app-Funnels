import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics } from "@/lib/analytics";
import { StatTile } from "./StatTile";
import { ConversationsTrendChart } from "./ConversationsTrendChart";
import { MessagesStackedChart } from "./MessagesStackedChart";
import { StageDistributionChart } from "./StageDistributionChart";

type Status = "good" | "warning" | "critical" | "neutral";

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "<1 min";
  return value < 10 ? `${value.toFixed(1)} min` : `${Math.round(value)} min`;
}

function automationStatus(rate: number | null): Status {
  if (rate === null) return "neutral";
  if (rate >= 80) return "good";
  if (rate >= 50) return "warning";
  return "critical";
}

function errorStatus(rate: number | null): Status {
  if (rate === null) return "neutral";
  if (rate <= 2) return "good";
  if (rate <= 10) return "warning";
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

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: true },
  });

  if (!membership) notFound();
  const { business } = membership;

  const analytics = await getBusinessAnalytics(id);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">KPIs y analítica</h1>
          <span className="fl-mono text-xs tracking-wide text-ink-muted">Últimos 30 días</span>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Conversaciones totales" value={String(analytics.totalConversations)} sublabel={`+${analytics.newConversations} en 30 días`} />
        <StatTile label="Mensajes (30 días)" value={String(analytics.totalMessages)} />
        <StatTile
          label="Automatización IA"
          value={formatPercent(analytics.automationRate)}
          sublabel="de respuestas sin humano"
          status={automationStatus(analytics.automationRate)}
        />
        <StatTile
          label="Tiempo de respuesta"
          value={formatMinutes(analytics.responseTime.avgMinutes)}
          sublabel={analytics.responseTime.sampleSize > 0 ? `${analytics.responseTime.sampleSize} muestras` : undefined}
          status={responseTimeStatus(analytics.responseTime.avgMinutes)}
        />
        <StatTile
          label="Tasa de error IA"
          value={formatPercent(analytics.errorRate)}
          sublabel="fallas técnicas del agente"
          status={errorStatus(analytics.errorRate)}
        />
        <StatTile
          label="Esperando respuesta"
          value={String(analytics.awaitingReply)}
          sublabel="conversaciones sin contestar"
          status={awaitingReplyStatus(analytics.awaitingReply)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-ink">Conversaciones nuevas por día</h2>
          <ConversationsTrendChart data={analytics.conversationsTrend} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-ink">Mensajes por día, por tipo</h2>
          <MessagesStackedChart data={analytics.messagesTrend} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-ink">Conversaciones por etapa del pipeline</h2>
        {analytics.stageDistribution.length === 0 ? (
          <p className="text-sm text-ink-muted">Este negocio todavía no tiene etapas configuradas.</p>
        ) : (
          <StageDistributionChart stages={analytics.stageDistribution} />
        )}
      </section>
    </div>
  );
}
