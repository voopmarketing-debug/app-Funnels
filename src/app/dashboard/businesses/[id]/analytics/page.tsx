import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, isDateRangeKey, type DateRangeKey } from "@/lib/analytics";
import { StatTile } from "./StatTile";
import { ConversationsTrendChart } from "./ConversationsTrendChart";
import { MessagesStackedChart } from "./MessagesStackedChart";
import { StageDistributionChart } from "./StageDistributionChart";
import { SalesDiagnosisPanel } from "./SalesDiagnosisPanel";
import { DateRangeSelector } from "./DateRangeSelector";
import type { SalesDiagnosis } from "@/lib/diagnosis";

type Status = "good" | "warning" | "critical" | "neutral";

// Short noun phrase per range, for composing sublabels like "+3 hoy" or
// "Mensajes (7 días)" without special-casing every call site.
const RANGE_NOUN_PHRASE: Record<DateRangeKey, string> = {
  today: "hoy",
  yesterday: "ayer",
  "7d": "7 días",
  "15d": "15 días",
  "30d": "30 días",
};

function newConversationsSublabel(rangeKey: DateRangeKey, count: number): string {
  if (rangeKey === "today" || rangeKey === "yesterday") return `+${count} ${RANGE_NOUN_PHRASE[rangeKey]}`;
  return `+${count} en ${RANGE_NOUN_PHRASE[rangeKey]}`;
}

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

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range } = await searchParams;
  const rangeKey: DateRangeKey = range && isDateRangeKey(range) ? range : "30d";

  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { include: { agent: true } } },
  });

  if (!membership) notFound();
  const { business } = membership;

  const analytics = await getBusinessAnalytics(id, rangeKey);

  const diagnosis =
    business.agent?.diagnosisReport && business.agent.diagnosisGeneratedAt
      ? {
          diagnosis: business.agent.diagnosisReport as unknown as SalesDiagnosis,
          generatedAt: business.agent.diagnosisGeneratedAt.toISOString(),
        }
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">KPIs y analítica</h1>
          <DateRangeSelector value={rangeKey} />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Conversaciones totales"
          value={String(analytics.totalConversations)}
          sublabel={newConversationsSublabel(rangeKey, analytics.newConversations)}
          description="Cuántas personas distintas te han escrito por WhatsApp en total, desde siempre."
        />
        <StatTile
          label={`Mensajes (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.totalMessages)}
          description="Cuántos mensajes se intercambiaron en el período seleccionado — los que mandaron tus clientes y los que respondiste tú (IA o humano)."
        />
        <StatTile
          label="Automatización IA"
          value={formatPercent(analytics.automationRate)}
          sublabel="de respuestas sin humano"
          status={automationStatus(analytics.automationRate)}
          description="De cada 100 respuestas enviadas, cuántas las contestó la IA sola, sin que nadie de tu equipo interviniera a mano."
        />
        <StatTile
          label="Tiempo de respuesta"
          value={formatMinutes(analytics.responseTime.avgMinutes)}
          sublabel={analytics.responseTime.sampleSize > 0 ? `${analytics.responseTime.sampleSize} muestras` : undefined}
          status={responseTimeStatus(analytics.responseTime.avgMinutes)}
          description="En promedio, cuánto tarda en llegar una respuesta después de que un cliente escribe. Entre menos, mejor experiencia para el cliente."
        />
        <StatTile
          label="Tasa de error IA"
          value={formatPercent(analytics.errorRate)}
          sublabel="fallas técnicas del agente"
          status={errorStatus(analytics.errorRate)}
          description="De cada 100 intentos de respuesta, cuántos fallaron por un error técnico (no por una mala respuesta). Si ves un número alto, avísanos — no es cosa tuya."
        />
        <StatTile
          label="Esperando respuesta"
          value={String(analytics.awaitingReply)}
          sublabel="conversaciones sin contestar"
          status={awaitingReplyStatus(analytics.awaitingReply)}
          description="Conversaciones donde el cliente escribió último y todavía nadie —ni la IA ni una persona— le ha contestado."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fl-card p-4">
          <h2 className="text-sm font-semibold text-ink">Conversaciones nuevas por día</h2>
          <p className="mb-4 mt-1 text-xs text-ink-faint">
            Cuántos clientes nuevos empezaron a escribirte cada día — te muestra si tu flujo de leads está creciendo o parado.
          </p>
          <ConversationsTrendChart data={analytics.conversationsTrend} />
        </div>

        <div className="fl-card p-4">
          <h2 className="text-sm font-semibold text-ink">Mensajes por día, por tipo</h2>
          <p className="mb-4 mt-1 text-xs text-ink-faint">
            Quién contestó cada mensaje: el cliente, tu IA, o una persona de tu equipo a mano.
          </p>
          <MessagesStackedChart data={analytics.messagesTrend} />
        </div>
      </section>

      <section className="fl-card p-4">
        <h2 className="text-sm font-semibold text-ink">Conversaciones por etapa del pipeline</h2>
        <p className="mb-4 mt-1 text-xs text-ink-faint">
          Cuántas conversaciones tienes hoy en cada etapa de tu embudo de ventas — te dice dónde se te están quedando los leads.
        </p>
        {analytics.stageDistribution.length === 0 ? (
          <p className="text-sm text-ink-muted">Este negocio todavía no tiene etapas configuradas.</p>
        ) : (
          <StageDistributionChart stages={analytics.stageDistribution} />
        )}
      </section>

      <SalesDiagnosisPanel businessId={id} initialDiagnosis={diagnosis} />
    </div>
  );
}
