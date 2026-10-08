import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics, getActiveContactsThisMonth, isDateRangeKey, type DateRangeKey } from "@/lib/analytics";
import { RangePills } from "./analytics/RangePills";
import { getAccountAddonCapacity, getBusinessOwnerId } from "@/lib/addons";
import { findPack } from "@/lib/addonPacks";
import { PLAN_LIMITS, planUsageStatus } from "@/lib/plans";
import { AgentForm } from "./AgentForm";
import { WabaCredentialsForm } from "./WabaCredentialsForm";
import { AgentMediaManager } from "./AgentMediaManager";
import { AgentPowerButton } from "./AgentPowerButton";
import { PlanUsageCard } from "./PlanUsageCard";
import { StatTile } from "./analytics/StatTile";
import { ChatIcon, ClockIcon, BoltIcon, HourglassIcon } from "./analytics/StatIcons";
import { WhatsAppHealthPanel } from "./WhatsAppHealthPanel";
import { isRecentWebhookError } from "@/lib/whatsappHealth";
import { IntegrationCard, type IntegrationStatus } from "./IntegrationCard";
import { WhatsAppLogo, SparkLogo, CatalogLogo, TemplateLogo, WebsiteLogo, TeamLogo, ProductsLogo, InventoryLogo } from "./IntegrationLogos";

// Fixed brand tiles — same in light and dark, like Kommo's integration logos.
const TILE = {
  whatsapp: "linear-gradient(135deg, #128c4a, #0b5d32)",
  ai: "linear-gradient(135deg, #8b5cf6, #5b21b6)",
  catalog: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  templates: "linear-gradient(135deg, #14b8a6, #0f766e)",
  website: "linear-gradient(135deg, #f59e0b, #c2410c)",
  team: "linear-gradient(135deg, #ec4899, #9d174d)",
  products: "linear-gradient(135deg, #f97316, #9a3412)",
  inventory: "linear-gradient(135deg, #64748b, #334155)",
};

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

const RANGE_PHRASE: Record<DateRangeKey, string> = {
  today: "hoy",
  yesterday: "ayer",
  "7d": "en los últimos 7 días",
  "15d": "en los últimos 15 días",
  "30d": "en el último mes",
};

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; compra?: string }>;
}) {
  const { id } = await params;
  const { range, compra } = await searchParams;
  // "Rendimiento" opens on today's numbers; the pills switch the period.
  const rangeKey: DateRangeKey = range && isDateRangeKey(range) ? range : "today";
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { include: { agent: true } } },
  });

  if (!membership) notFound();
  const { business } = membership;
  // A MEMBER is an invited teammate (e.g. a salesperson) — full CRM access,
  // but locked out of business-wide settings (see requireBusinessOwnerOrAdmin
  // in lib/authz.ts). Everything below that's owner/admin-only is skipped
  // entirely for them, not just visually hidden.
  const canManageBusiness = membership.role !== "MEMBER";

  const [analytics, activeContacts, agentMedia, approvedTemplates, websiteCount, teamMembers, productCount, stockedProducts] = await Promise.all([
    getBusinessAnalytics(id, rangeKey),
    getActiveContactsThisMonth(id),
    canManageBusiness
      ? prisma.agentMedia.findMany({
          where: { businessId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, label: true, mediaType: true, filename: true, sizeBytes: true, url: true },
        })
      : Promise.resolve([]),
    prisma.messageTemplate.count({ where: { businessId: id, status: "APPROVED" } }),
    prisma.website.count({ where: { businessId: id } }),
    prisma.membership.count({ where: { businessId: id, role: "MEMBER" } }),
    prisma.product.count({ where: { businessId: id } }),
    prisma.product.findMany({ where: { businessId: id, trackStock: true }, select: { stock: true, lowStockAt: true } }),
  ]);
  const soldOutCount = stockedProducts.filter((p) => p.stock <= 0).length;
  const lowStockCount = stockedProducts.filter((p) => p.stock > 0 && p.stock <= p.lowStockAt).length;
  const inventoryStatus: IntegrationStatus =
    stockedProducts.length === 0
      ? { tone: "todo", label: "Sin inventario" }
      : soldOutCount + lowStockCount > 0
        ? { tone: "warn", label: [soldOutCount && `${soldOutCount} agotado${soldOutCount === 1 ? "" : "s"}`, lowStockCount && `${lowStockCount} por agotarse`].filter(Boolean).join(" · ") }
        : { tone: "done", label: `${stockedProducts.length} con stock` };

  // Plan + active packs, counted per account like the agent does.
  const ownerId = await getBusinessOwnerId(id);
  const addonCapacity = ownerId ? await getAccountAddonCapacity(ownerId) : null;
  const basePlanLimit = PLAN_LIMITS[business.planTier];
  const planLimit = basePlanLimit === null ? null : basePlanLimit + (addonCapacity?.extraContacts ?? 0);
  const planStatus = planUsageStatus(activeContacts, planLimit);
  // Back from Mercado Pago (?compra=<pack id>): say whether it's active yet.
  const purchase =
    compra && ownerId ? await prisma.accountAddon.findFirst({ where: { id: compra, userId: ownerId }, select: { status: true, packKey: true } }) : null;
  const canEditPlan = membership.role === "ADMIN";

  // Same "done" rules as Inicio's "Primeros pasos" checklist.
  const whatsappConnected = !!business.wabaPhoneNumberId && !!business.wabaAccessToken;
  const whatsappBroken = whatsappConnected && business.whatsappHealthOk === false;
  const promptReady = (business.agent?.systemPrompt?.trim().length ?? 0) >= 120;
  const hasConversations = analytics.totalConversations > 0;
  const period = RANGE_PHRASE[rangeKey];
  const setupSteps = [
    { id: "whatsapp", done: whatsappConnected, title: "Conecta tu WhatsApp", body: "Los datos que te da Meta para tu número." },
    { id: "instrucciones", done: promptReady, title: "Entrena a tu agente", body: "Qué vendes, precios y cómo debe responder." },
    { id: null, done: hasConversations, title: "Haz una prueba", body: "Escríbele \"Hola\" a tu número desde otro celular." },
  ];
  const setupDone = setupSteps.every((step) => step.done);

  const whatsappStatus: IntegrationStatus = whatsappBroken
    ? { tone: "warn", label: "Revisar conexión" }
    : whatsappConnected
      ? { tone: "done", label: "Conectado" }
      : { tone: "todo", label: "Sin conectar" };

  // The health panel is reassurance when all is well (shown under the
  // connections) and an alarm when it isn't (moved to the top).
  const healthProblem =
    whatsappBroken || (business.webhookErrorAt !== null && isRecentWebhookError(business.webhookErrorAt));
  const healthPanel =
    canManageBusiness && business.wabaPhoneNumberId ? (
      <WhatsAppHealthPanel
          businessId={id}
          lastWebhookAt={business.lastWebhookAt}
          webhookError={isRecentWebhookError(business.webhookErrorAt) ? business.webhookError : null}
          webhookErrorAt={isRecentWebhookError(business.webhookErrorAt) ? business.webhookErrorAt : null}
          healthOk={business.whatsappHealthOk}
          healthMessage={business.whatsappHealthMessage}
          healthCheckedAt={business.whatsappHealthCheckedAt}
        />
    ) : null;

  const shortcutClass =
    "flex-none whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-accent hover:text-ink";

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white [&_svg]:h-6 [&_svg]:w-6"
            style={{ background: TILE.ai }}
          >
            <SparkLogo />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{business.name}</h1>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                className={`h-1.5 w-1.5 flex-none rounded-full ${
                  whatsappBroken ? "bg-error" : whatsappConnected ? "bg-accent" : "bg-ink-faint"
                }`}
              />
              {whatsappBroken ? "WhatsApp con problemas" : whatsappConnected ? "WhatsApp conectado" : "WhatsApp sin conectar"}
            </p>
          </div>
        </div>
        {/* On phones the shortcuts scroll sideways in one row instead of
            pushing the page wider than the screen. */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible md:pb-0">
          {canManageBusiness && (
            <div className="order-first flex-none whitespace-nowrap md:order-last">
              <AgentPowerButton businessId={id} enabled={business.agent?.enabled ?? true} />
            </div>
          )}
          <Link href={`/dashboard/businesses/${id}/crm`} className={shortcutClass}>
            Conversaciones
          </Link>
          <Link href={`/dashboard/businesses/${id}/analytics`} className={shortcutClass}>
            KPIs
          </Link>
        </div>
      </header>

      {purchase && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            purchase.status === "ACTIVE" ? "border-accent/50 bg-accent/10 text-ink" : "border-border bg-surface text-ink-muted"
          }`}
        >
          {purchase.status === "ACTIVE"
            ? `✅ ¡Listo! Tu paquete ${findPack(purchase.packKey)?.title ?? ""} ya está activo y sumado a tu plan.`
            : "⏳ Estamos confirmando tu pago con Mercado Pago. En cuanto se apruebe, el paquete se activa solo y te avisamos en la campana (recarga en un minuto)."}
        </div>
      )}

      {canManageBusiness && !setupDone && (
        <section className="fl-card-hero p-4 md:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Pon a funcionar tu agente</h2>
            <p className="text-xs text-ink-muted">
              {setupSteps.filter((step) => step.done).length} de {setupSteps.length} pasos listos
            </p>
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {setupSteps.map((step, index) => {
              const isNext = !step.done && setupSteps.slice(0, index).every((prev) => prev.done);
              return (
                <li
                  key={step.title}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    isNext ? "border-accent/50 bg-accent/5" : "border-border bg-surface/60"
                  }`}
                >
                  <span
                    className={`fl-mono flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${
                      step.done ? "bg-accent text-accent-ink" : isNext ? "border-2 border-accent text-accent" : "border border-border text-ink-faint"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${step.done ? "text-ink-muted line-through decoration-ink-faint" : "text-ink"}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-ink-muted">{step.body}</p>
                    {isNext && step.id && (
                      <a
                        href={`#${step.id}`}
                        className="mt-2 inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
                      >
                        Empezar
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {healthProblem && healthPanel}

      {canManageBusiness ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Conexiones del agente</h2>
            <p className="text-xs text-ink-muted">
              Todo lo que tu agente necesita para vender. Empieza por lo <span className="font-semibold text-accent">obligatorio</span>.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <IntegrationCard
              id="whatsapp"
              title="WhatsApp Business"
              description="Conecta tu número con los datos que te da Meta para que el agente reciba y responda mensajes."
              logo={<WhatsAppLogo />}
              logoBackground={TILE.whatsapp}
              status={whatsappStatus}
              actionLabel={whatsappConnected ? "Configurar" : "Conectar"}
              required
              dialogTitle="Conectar WhatsApp Business"
            >
              <WabaCredentialsForm
                businessId={id}
                wabaPhoneNumberId={business.wabaPhoneNumberId ?? ""}
                wabaId={business.wabaId ?? ""}
              />
            </IntegrationCard>
            <IntegrationCard
              id="instrucciones"
              title="Instrucciones del agente"
              description="Qué vendes, precios, horarios y cómo debe hablarle la IA a tus clientes."
              logo={<SparkLogo />}
              logoBackground={TILE.ai}
              status={promptReady ? { tone: "done", label: "Entrenado" } : { tone: "todo", label: "Sin entrenar" }}
              actionLabel={promptReady ? "Editar" : "Entrenar"}
              required
              dialogTitle="Instrucciones del agente de IA"
            >
              <AgentForm
                businessId={id}
                systemPrompt={business.agent?.systemPrompt ?? ""}
                tone={business.agent?.tone ?? "cercano"}
                replyLength={business.agent?.replyLength ?? "breve"}
                industry={business.industry}
              />
            </IntegrationCard>
            <IntegrationCard
              id="catalogo"
              title="Fotos y catálogo"
              description="Fotos de productos o un PDF que la IA envía sola cuando un cliente los pide."
              logo={<CatalogLogo />}
              logoBackground={TILE.catalog}
              status={
                agentMedia.length > 0
                  ? { tone: "done", label: `${agentMedia.length} ${agentMedia.length === 1 ? "archivo" : "archivos"}` }
                  : { tone: "todo", label: "Sin archivos" }
              }
              actionLabel={agentMedia.length > 0 ? "Administrar" : "Agregar"}
              dialogTitle="Fotos y catálogo para la IA"
            >
              <AgentMediaManager businessId={id} media={agentMedia} />
            </IntegrationCard>
            <IntegrationCard
              id="productos"
              title="Productos"
              description="Tu catálogo con fotos y precios para tiendas y páginas de producto con pedido por WhatsApp."
              logo={<ProductsLogo />}
              logoBackground={TILE.products}
              status={
                productCount > 0
                  ? { tone: "done", label: `${productCount} ${productCount === 1 ? "producto" : "productos"}` }
                  : { tone: "todo", label: "Sin productos" }
              }
              actionLabel={productCount > 0 ? "Administrar" : "Agregar"}
              href={`/dashboard/businesses/${id}/productos`}
            />
            <IntegrationCard
              id="inventario"
              title="Inventario"
              description="Unidades de cada producto: se descuentan con cada venta y te avisamos cuando algo se esté acabando."
              logo={<InventoryLogo />}
              logoBackground={TILE.inventory}
              status={inventoryStatus}
              actionLabel={stockedProducts.length > 0 ? "Ver inventario" : "Activar"}
              href={`/dashboard/businesses/${id}/inventario`}
            />
            <IntegrationCard
              id="plantillas"
              title="Plantillas de WhatsApp"
              description="Mensajes aprobados por Meta para escribir después de 24 h y enviar difusiones."
              logo={<TemplateLogo />}
              logoBackground={TILE.templates}
              status={
                approvedTemplates > 0
                  ? { tone: "done", label: `${approvedTemplates} ${approvedTemplates === 1 ? "aprobada" : "aprobadas"}` }
                  : { tone: "todo", label: business.wabaId ? "Ninguna aprobada" : "Requiere WABA ID" }
              }
              actionLabel={approvedTemplates > 0 ? "Ver plantillas" : "Crear"}
              href={`/dashboard/businesses/${id}/templates`}
            />
            <IntegrationCard
              id="sitio-web"
              title="Sitio web y agenda"
              description="Una página hecha con IA y un calendario de citas que llevan clientes a tu WhatsApp."
              logo={<WebsiteLogo />}
              logoBackground={TILE.website}
              status={
                websiteCount > 0
                  ? { tone: "done", label: `${websiteCount} ${websiteCount === 1 ? "página" : "páginas"}` }
                  : { tone: "todo", label: "Sin páginas" }
              }
              actionLabel={websiteCount > 0 ? "Ver páginas" : "Crear"}
              href={`/dashboard/businesses/${id}/website`}
            />
            <IntegrationCard
              id="equipo"
              title="Equipo de ventas"
              description="Invita a tus vendedores para que atiendan conversaciones desde el CRM."
              logo={<TeamLogo />}
              logoBackground={TILE.team}
              status={
                teamMembers > 0
                  ? { tone: "done", label: `${teamMembers} ${teamMembers === 1 ? "vendedor" : "vendedores"}` }
                  : { tone: "todo", label: "Solo tú" }
              }
              actionLabel={teamMembers > 0 ? "Administrar" : "Invitar"}
              href="/dashboard/account"
            />
          </div>
        </section>
      ) : (
        <div className="fl-card p-6 text-center">
          <p className="text-sm text-ink">
            Tu acceso a este negocio es de equipo de ventas: puedes trabajar el CRM y tus conversaciones, pero no
            la configuración del negocio.
          </p>
          <Link
            href={`/dashboard/businesses/${id}/crm`}
            className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Ir al CRM
          </Link>
        </div>
      )}

      {!healthProblem && healthPanel}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Rendimiento</h2>
          <RangePills value={rangeKey} />
        </div>
        {canManageBusiness && (
          <PlanUsageCard
            businessId={id}
            planTier={business.planTier}
            used={activeContacts}
            limit={planLimit}
            status={planStatus}
            canEditPlan={canEditPlan}
          />
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Clientes nuevos"
            hint="Te escribieron por primera vez"
            value={String(analytics.newConversations)}
            sublabel={`${analytics.totalConversations.toLocaleString("es-CO")} en total`}
            description={`Personas que te escribieron por primera vez ${period}.`}
            tone="accent"
            icon={<ChatIcon />}
          />
          <StatTile
            label="Tiempo de respuesta"
            hint="Promedio hasta que el cliente recibe respuesta"
            value={formatMinutes(analytics.responseTime.avgMinutes)}
            status={responseTimeStatus(analytics.responseTime.avgMinutes)}
            description={`En promedio ${period}, cuánto tardó en llegar una respuesta después de que un cliente escribió. Entre menos, mejor.`}
            tone="amber"
            icon={<ClockIcon />}
          />
          <StatTile
            label="Atendido por la IA"
            hint="Respuestas sin que nadie interviniera"
            value={formatPercent(analytics.automationRate)}
            status={automationStatus(analytics.automationRate)}
            description={`De cada 100 respuestas enviadas ${period}, cuántas las contestó la IA sola, sin que nadie de tu equipo interviniera.`}
            tone="secondary"
            icon={<BoltIcon />}
          />
          <StatTile
            label="Esperando respuesta"
            hint="Clientes sin contestar"
            value={String(analytics.awaitingReply)}
            sublabel="ahora mismo"
            status={awaitingReplyStatus(analytics.awaitingReply)}
            description="Conversaciones donde el cliente escribió último y todavía nadie —ni la IA ni una persona— le ha contestado."
            tone="blue"
            icon={<HourglassIcon />}
          />
        </div>
      </section>
    </div>
  );
}
