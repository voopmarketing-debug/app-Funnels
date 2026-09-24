import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, isDateRangeKey, type DateRangeKey } from "@/lib/analytics";
import { StatTile } from "./StatTile";
import {
  ChatIcon,
  MessageIcon,
  BoltIcon,
  ClockIcon,
  AlertIcon,
  HourglassIcon,
  LayersIcon,
  CostIcon,
  GlobeIcon,
  WhatsAppSmallIcon,
  CalendarLinkIcon,
  CalendarCheckIcon,
  FunnelIcon,
  RegisterFormIcon,
} from "./StatIcons";
import { ConversationsTrendChart } from "./ConversationsTrendChart";
import { MessagesStackedChart } from "./MessagesStackedChart";
import { StageDistributionChart } from "./StageDistributionChart";
import { SalesDiagnosisPanel } from "./SalesDiagnosisPanel";
import { DateRangeSelector } from "./DateRangeSelector";
import { AgentSwitcher } from "../AgentSwitcher";
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

function conversionStatus(rate: number | null): Status {
  if (rate === null) return "neutral";
  if (rate >= 20) return "good";
  if (rate >= 5) return "warning";
  return "critical";
}

// Real spend, not the plan-tier estimate elsewhere in the app — see
// realAiCostUsd in lib/analytics.ts. "—" (not "$0.00") when there's no
// usage data yet for this range, so an empty range never reads as free.
function formatCostUsd(value: number | null): string {
  if (value === null) return "—";
  if (value < 0.01 && value > 0) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

const SECTION_ICON_GLOW: Record<"accent" | "blue" | "secondary", string> = {
  accent: "--glow-accent",
  blue: "--glow-blue",
  secondary: "--glow-secondary",
};

function SectionHeading({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode;
  tone: "accent" | "blue" | "secondary";
  title: string;
  description: string;
}) {
  const glowVar = SECTION_ICON_GLOW[tone];
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
        style={{ backgroundColor: `rgba(var(${glowVar}), 0.16)`, color: `rgba(var(${glowVar}), 1)` }}
      >
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-faint">{description}</p>
      </div>
    </div>
  );
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

  const accessibleBusinesses = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { business: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const analytics = await getBusinessAnalytics(id, rangeKey);

  const diagnosis =
    business.agent?.diagnosisReport && business.agent.diagnosisGeneratedAt
      ? {
          diagnosis: business.agent.diagnosisReport as unknown as SalesDiagnosis,
          generatedAt: business.agent.diagnosisGeneratedAt.toISOString(),
        }
      : null;

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">KPIs y analítica</h1>
          <div className="flex flex-wrap items-center gap-3">
            <AgentSwitcher
              businesses={accessibleBusinesses.map((m) => m.business)}
              currentId={id}
              section="analytics"
            />
            <DateRangeSelector value={rangeKey} />
          </div>
        </div>
      </div>

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Conversaciones totales"
          value={String(analytics.totalConversations)}
          sublabel={newConversationsSublabel(rangeKey, analytics.newConversations)}
          description="Cuántas personas distintas te han escrito por WhatsApp en total, desde siempre."
          tone="accent"
          icon={<ChatIcon />}
        />
        <StatTile
          label={`Mensajes (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.totalMessages)}
          sublabel={`${analytics.messagesByRole.cliente} cliente · ${analytics.messagesByRole.ia} IA · ${analytics.messagesByRole.humano} tú`}
          description="Cuántos mensajes se intercambiaron en el período seleccionado, sumando las tres líneas: los que mandó el cliente, los que contestó la IA sola y los que escribiste tú a mano. El total suele parecer alto porque cuenta cada mensaje del ida y vuelta, no solo los tuyos."
          tone="blue"
          icon={<MessageIcon />}
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
          label="Tiempo de respuesta"
          value={formatMinutes(analytics.responseTime.avgMinutes)}
          sublabel={analytics.responseTime.sampleSize > 0 ? `${analytics.responseTime.sampleSize} muestras` : undefined}
          status={responseTimeStatus(analytics.responseTime.avgMinutes)}
          description="En promedio, cuánto tarda en llegar una respuesta después de que un cliente escribe. Entre menos, mejor experiencia para el cliente."
          tone="amber"
          icon={<ClockIcon />}
        />
        <StatTile
          label="Tasa de error IA"
          value={formatPercent(analytics.errorRate)}
          sublabel="fallas técnicas del agente"
          status={errorStatus(analytics.errorRate)}
          description="De cada 100 intentos de respuesta, cuántos fallaron por un error técnico (no por una mala respuesta). Si ves un número alto, avísanos — no es cosa tuya."
          tone="accent"
          icon={<AlertIcon />}
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
        <StatTile
          label={`Visitas al sitio web (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.websiteViews)}
          description="Cuántas veces se abrió alguna de las páginas web de este negocio (ver sección Sitio web) en el período seleccionado."
          tone="blue"
          icon={<GlobeIcon />}
        />
        <StatTile
          label={`Clics a WhatsApp (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.websiteClicksWhatsapp)}
          description="Cuántas veces alguien le dio clic a un botón que lleva al WhatsApp del negocio, en alguna página web."
          tone="accent"
          icon={<WhatsAppSmallIcon />}
        />
        <StatTile
          label={`Clics a agenda / link externo (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.websiteClicksAgenda)}
          description="Cuántas veces alguien le dio clic a un botón que lleva a un link externo (como tu agenda), en páginas configuradas para eso."
          tone="secondary"
          icon={<CalendarLinkIcon />}
        />
        <StatTile
          label={`Citas agendadas (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.appointmentsBooked)}
          description="Conversaciones con una cita registrada (desde el panel de CRM) cuya fecha cae dentro del período seleccionado."
          tone="secondary"
          icon={<CalendarCheckIcon />}
        />
        <StatTile
          label="Tasa de conversión a cita"
          value={formatPercent(analytics.appointmentConversionRate)}
          sublabel="de conversaciones nuevas"
          status={conversionStatus(analytics.appointmentConversionRate)}
          description="De cada 100 conversaciones nuevas en el período, cuántas terminaron en una cita agendada. Es tu métrica de resultado real, no solo de actividad."
          tone="amber"
          icon={<FunnelIcon />}
        />
        <StatTile
          label={`Registros capturados (${RANGE_NOUN_PHRASE[rangeKey]})`}
          value={String(analytics.websiteLeads)}
          description="Personas que dejaron sus datos (nombre y WhatsApp) en el formulario de alguna de tus páginas web, en el período seleccionado."
          tone="blue"
          icon={<RegisterFormIcon />}
        />
        {membership.role === "ADMIN" && (
          <StatTile
            label={`Costo real de IA (${RANGE_NOUN_PHRASE[rangeKey]})`}
            value={formatCostUsd(analytics.realAiCostUsd)}
            sublabel="gasto real en Anthropic"
            description="Lo que de verdad costó en la API de Anthropic responder estas conversaciones — visible solo para la agencia, para medir rentabilidad."
            tone="secondary"
            icon={<CostIcon />}
          />
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fl-card min-w-0 p-4">
          <SectionHeading
            icon={<ChatIcon />}
            tone="accent"
            title="Conversaciones nuevas por día"
            description="Cuántos clientes nuevos empezaron a escribirte cada día — te muestra si tu flujo de leads está creciendo o parado."
          />
          <ConversationsTrendChart data={analytics.conversationsTrend} />
        </div>

        <div className="fl-card min-w-0 p-4">
          <SectionHeading
            icon={<MessageIcon />}
            tone="blue"
            title="Mensajes por día, por tipo"
            description="Quién contestó cada mensaje: el cliente, tu IA, o una persona de tu equipo a mano."
          />
          <MessagesStackedChart data={analytics.messagesTrend} />
        </div>
      </section>

      <section className="fl-card min-w-0 p-4">
        <SectionHeading
          icon={<LayersIcon />}
          tone="secondary"
          title="Conversaciones por etapa del pipeline"
          description="Cuántas conversaciones tienes hoy en cada etapa de tu embudo de ventas — te dice dónde se te están quedando los leads."
        />
        {analytics.stageDistribution.length === 0 ? (
          <p className="text-sm text-ink-muted">Este negocio todavía no tiene etapas configuradas.</p>
        ) : (
          <StageDistributionChart stages={analytics.stageDistribution} />
        )}
      </section>

      <SalesDiagnosisPanel businessId={id} businessName={business.name} initialDiagnosis={diagnosis} />
    </div>
  );
}
