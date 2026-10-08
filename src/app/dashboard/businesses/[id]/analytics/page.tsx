import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, isDateRangeKey, type DateRangeKey } from "@/lib/analytics";
import { getSalesSummary } from "@/lib/salesMetrics";
import { StatTile } from "./StatTile";
import { SalesSection } from "./SalesSection";
import {
  ChatIcon,
  MessageIcon,
  BoltIcon,
  ClockIcon,
  AlertIcon,
  HourglassIcon,
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
import { RangePills } from "./RangePills";
import { AgentSwitcher } from "../AgentSwitcher";
import type { SalesDiagnosis } from "@/lib/diagnosis";

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

const RANGE_LABEL: Record<DateRangeKey, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  "7d": "Últimos 7 días",
  "15d": "Últimos 15 días",
  "30d": "Últimos 30 días",
};

function KpiSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fl-card min-w-0 p-4 md:p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mb-4 mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      {children}
    </div>
  );
}

// Same series colors as MessagesStackedChart, so the split reads as the chart's legend.
function MessageSplit({ cliente, ia, humano }: { cliente: number; ia: number; humano: number }) {
  const total = cliente + ia + humano;
  const parts = [
    { label: "Clientes", value: cliente, color: "#3987e5" },
    { label: "IA", value: ia, color: "#199e70" },
    { label: "Tu equipo", value: humano, color: "#d95926" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-border">
        {total > 0 && parts.map((p) => (p.value > 0 ? <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul className="space-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="font-semibold tabular-nums text-ink">{p.value.toLocaleString("es-CO")}</span>
          </li>
        ))}
      </ul>
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

  const [analytics, sales] = await Promise.all([getBusinessAnalytics(id, rangeKey), getSalesSummary(id, rangeKey)]);

  const diagnosis =
    business.agent?.diagnosisReport && business.agent.diagnosisGeneratedAt
      ? {
          diagnosis: business.agent.diagnosisReport as unknown as SalesDiagnosis,
          generatedAt: business.agent.diagnosisGeneratedAt.toISOString(),
        }
      : null;

  const period = RANGE_LABEL[rangeKey];
  const isAgency = membership.role === "ADMIN";
  const messages = analytics.messagesByRole;
  const messageTotal = messages.cliente + messages.ia + messages.humano;

  return (
    <div className="min-w-0 space-y-10">
      <header className="space-y-4">
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">KPIs</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              Cómo le va a tu negocio en WhatsApp: cuántos clientes llegan, cuántos agendan y qué tan bien responde tu agente.
              Toca <span aria-hidden="true">ⓘ</span> en cualquier tarjeta para ver qué significa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AgentSwitcher businesses={accessibleBusinesses.map((m) => m.business)} currentId={id} section="analytics" />
            <RangePills value={rangeKey} />
          </div>
        </div>
      </header>

      <SalesSection businessId={id} summary={sales} period={period} />

      <KpiSection title="Resultados" subtitle={`Lo que de verdad importa: clientes que llegan y se convierten · ${period}`}>
        <StatTile
          label="Clientes nuevos"
          hint="Personas que te escribieron por primera vez"
          value={analytics.newConversations.toLocaleString("es-CO")}
          sublabel={`${analytics.totalConversations.toLocaleString("es-CO")} en total`}
          description="Cuántas personas distintas te escribieron por primera vez por WhatsApp en el período. El número pequeño es el total desde que empezaste."
          tone="accent"
          icon={<ChatIcon />}
        />
        <StatTile
          label="Citas agendadas"
          hint="Citas con fecha dentro del período"
          value={analytics.appointmentsBooked.toLocaleString("es-CO")}
          description="Conversaciones con una cita registrada (por la IA o desde el CRM) cuya fecha cae dentro del período seleccionado."
          tone="secondary"
          icon={<CalendarCheckIcon />}
        />
        <StatTile
          label="Conversión a cita"
          hint="De cada 100 clientes nuevos, cuántos agendan"
          value={formatPercent(analytics.appointmentConversionRate)}
          status={conversionStatus(analytics.appointmentConversionRate)}
          goal="Meta: 20% o más"
          description="De cada 100 conversaciones nuevas en el período, cuántas terminaron en una cita agendada. Es tu métrica de resultado real, no solo de actividad."
          tone="amber"
          icon={<FunnelIcon />}
        />
        <StatTile
          label="Registros de tu web"
          hint="Personas que dejaron sus datos"
          value={analytics.websiteLeads.toLocaleString("es-CO")}
          description="Personas que dejaron su nombre y WhatsApp en el formulario de alguna de tus páginas web, en el período seleccionado."
          tone="blue"
          icon={<RegisterFormIcon />}
        />
      </KpiSection>

      <KpiSection title="Tu agente de IA" subtitle="Qué tan rápido y qué tan solo atiende a tus clientes">
        <StatTile
          label="Atendido por la IA"
          hint="Respuestas sin que nadie interviniera"
          value={formatPercent(analytics.automationRate)}
          status={automationStatus(analytics.automationRate)}
          goal="Meta: 80% o más"
          description="De cada 100 respuestas enviadas, cuántas las contestó la IA sola, sin que nadie de tu equipo escribiera a mano."
          tone="secondary"
          icon={<BoltIcon />}
        />
        <StatTile
          label="Tiempo de respuesta"
          hint="Promedio hasta que el cliente recibe respuesta"
          value={formatMinutes(analytics.responseTime.avgMinutes)}
          status={responseTimeStatus(analytics.responseTime.avgMinutes)}
          goal="Meta: menos de 5 min"
          description="En promedio, cuánto tarda en llegar una respuesta después de que un cliente escribe. Entre menos, más ventas: un cliente que espera se va con otro."
          tone="amber"
          icon={<ClockIcon />}
        />
        <StatTile
          label="Esperando respuesta"
          hint="Clientes que escribieron y nadie ha contestado"
          value={analytics.awaitingReply.toLocaleString("es-CO")}
          sublabel="ahora mismo"
          status={awaitingReplyStatus(analytics.awaitingReply)}
          goal="Meta: 0"
          description="Conversaciones donde el cliente escribió último y todavía nadie (ni la IA ni una persona) le ha contestado. Revísalas en el CRM."
          tone="blue"
          icon={<HourglassIcon />}
        />
        <StatTile
          label="Fallas técnicas"
          hint="Respuestas que no salieron por un error"
          value={formatPercent(analytics.errorRate)}
          status={errorStatus(analytics.errorRate)}
          goal="Meta: 2% o menos"
          description="De cada 100 intentos de respuesta, cuántos fallaron por un error técnico (no por una mala respuesta). Si ves un número alto, avísanos: no es cosa tuya."
          tone="accent"
          icon={<AlertIcon />}
        />
      </KpiSection>

      <KpiSection title="Conversaciones" subtitle={`El movimiento de tu WhatsApp · ${period}`}>
        <div className="col-span-2 lg:col-span-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ChartCard title="Clientes nuevos por día" subtitle="Si la línea sube, cada vez te escribe más gente.">
              <ConversationsTrendChart data={analytics.conversationsTrend} />
            </ChartCard>
            <StatTile
              label="Mensajes"
              hint="Todo el ida y vuelta del período"
              value={messageTotal.toLocaleString("es-CO")}
              description="Todos los mensajes del período: los que mandaron tus clientes, los que contestó la IA y los que escribió tu equipo a mano. Suele verse alto porque cuenta cada mensaje del ida y vuelta."
              tone="blue"
              icon={<MessageIcon />}
            >
              <MessageSplit cliente={messages.cliente} ia={messages.ia} humano={messages.humano} />
            </StatTile>
          </div>
        </div>
        <div className="col-span-2 lg:col-span-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Mensajes por día" subtitle="Quién respondió cada día: tus clientes, la IA o tu equipo.">
              <MessagesStackedChart data={analytics.messagesTrend} />
            </ChartCard>
            <ChartCard title="Clientes por etapa de tu embudo" subtitle="Dónde están hoy tus clientes. Si se acumulan en una etapa, ahí se te están quedando.">
              {analytics.stageDistribution.length === 0 ? (
                <p className="text-sm text-ink-muted">Todavía no tienes etapas configuradas en el CRM.</p>
              ) : (
                <StageDistributionChart stages={analytics.stageDistribution} />
              )}
            </ChartCard>
          </div>
        </div>
      </KpiSection>

      <KpiSection title="Sitio web" subtitle={`Cuánta gente ve tus páginas y da el paso · ${period}`}>
        <StatTile
          label="Visitas"
          hint="Veces que se abrieron tus páginas"
          value={analytics.websiteViews.toLocaleString("es-CO")}
          description="Cuántas veces se abrió alguna de las páginas web de este negocio (sección Sitio web) en el período."
          tone="blue"
          icon={<GlobeIcon />}
        />
        <StatTile
          label="Clics a WhatsApp"
          hint="Visitantes que te escribieron desde la web"
          value={analytics.websiteClicksWhatsapp.toLocaleString("es-CO")}
          sublabel={analytics.websiteViews > 0 ? `${Math.round((analytics.websiteClicksWhatsapp / analytics.websiteViews) * 100)}% de las visitas` : undefined}
          description="Cuántas veces alguien tocó un botón que lleva al WhatsApp del negocio en alguna de tus páginas."
          tone="accent"
          icon={<WhatsAppSmallIcon />}
        />
        <StatTile
          label="Clics a tu agenda o enlace"
          hint="Visitantes que fueron a agendar"
          value={analytics.websiteClicksAgenda.toLocaleString("es-CO")}
          description="Cuántas veces alguien tocó un botón que lleva a un enlace externo (como tu agenda) en páginas configuradas para eso."
          tone="secondary"
          icon={<CalendarLinkIcon />}
        />
        {isAgency && (
          <StatTile
            label="Costo real de IA"
            hint="Solo lo ves tú (agencia)"
            value={formatCostUsd(analytics.realAiCostUsd)}
            description="Lo que de verdad costó en Anthropic responder estas conversaciones. Solo lo ve la agencia; el detalle por cliente está en Rentabilidad."
            tone="amber"
            icon={<CostIcon />}
          />
        )}
      </KpiSection>

      <SalesDiagnosisPanel businessId={id} businessName={business.name} initialDiagnosis={diagnosis} />
    </div>
  );
}
