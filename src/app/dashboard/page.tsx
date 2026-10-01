import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccountActiveContactsThisMonth, getActiveContactsThisMonth } from "@/lib/analytics";
import { LINE_LIMITS, PLAN_LABELS, PLAN_LIMITS, TEAM_MEMBER_LIMITS } from "@/lib/plans";
import { isSubscriptionActive } from "@/lib/subscription";
import { getLiveAnnouncements, safeAnnouncementUrl } from "@/lib/announcements";
import { SUPPORT_WHATSAPP_LINK, supportWhatsAppLink } from "@/lib/constants";
import { contactLabel } from "@/lib/contactDisplay";
import { AnnouncementBanner, NewsCard, type AnnouncementView } from "./AnnouncementViews";
import { BusinessPicker } from "./BusinessPicker";
import { getAccountAddonCapacity } from "@/lib/addons";
import { findPack } from "@/lib/addonPacks";
import { AddonStore } from "@/components/AddonStore";

const TZ = "America/Bogota";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight today in Bogotá, as a UTC instant (Colombia has no DST: UTC−5 year-round). */
function startOfTodayBogota(now: Date): Date {
  const local = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 5 * 60 * 60 * 1000);
}

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(now));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatDay(date: Date): string {
  const text = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatShort(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function toView(a: Awaited<ReturnType<typeof getLiveAnnouncements>>[number]): AnnouncementView {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    badge: a.badge,
    imageUrl: a.imageUrl,
    ctaLabel: a.ctaLabel,
    ctaUrl: safeAnnouncementUrl(a.ctaUrl),
  };
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const { b } = await searchParams;
  const now = new Date();

  const [user, memberships, announcements] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { role: true, business: { select: { id: true, name: true } } },
    }),
    getLiveAnnouncements(),
  ]);

  const banner = announcements.find((a) => a.kind === "BANNER");
  const news = announcements.filter((a) => a.kind === "NEWS").slice(0, 6);
  const firstName = user?.name?.trim().split(/\s+/)[0];

  // Which agent the summary is about: the one picked in the switcher, else
  // the user's own business, else the first one they can access.
  const current =
    memberships.find((m) => m.business.id === b) ??
    memberships.find((m) => m.role === "OWNER") ??
    memberships[0] ??
    null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {banner && <AnnouncementBanner announcement={toView(banner)} />}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{formatDay(now)}</p>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
        </div>
        {memberships.length > 1 && current && (
          <BusinessPicker
            currentId={current.business.id}
            businesses={memberships.map((m) => ({ id: m.business.id, name: m.business.name }))}
          />
        )}
      </header>

      {current ? (
        <BusinessOverview businessId={current.business.id} role={current.role} now={now} />
      ) : (
        <section className="fl-card-hero space-y-3 p-6 text-center">
          <h2 className="text-lg font-semibold text-ink">Crea tu primer agente de IA</h2>
          <p className="mx-auto max-w-md text-sm text-ink-muted">
            Conecta tu WhatsApp y deja que la IA atienda a tus clientes las 24 horas. Toma menos de 10 minutos.
          </p>
          <Link
            href="/dashboard/businesses/new"
            className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Crear mi agente
          </Link>
        </section>
      )}

      {news.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Novedades de Funnels Labs</h2>
            <p className="text-xs text-ink-muted">Lo último que agregamos a la plataforma.</p>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((n) => (
              <NewsCard key={n.id} item={toView(n)} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">¿Necesitas ayuda?</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <HelpCard
            icon="💬"
            title="Habla con soporte"
            body="Escríbenos por WhatsApp y te ayudamos a configurar o resolver lo que necesites."
            cta="Escribir a soporte"
            href={SUPPORT_WHATSAPP_LINK}
          />
          <HelpCard
            icon="🚀"
            title="Configuración guiada"
            body="Agenda una sesión con nuestro equipo y deja tu agente vendiendo desde el primer día."
            cta="Pedir una sesión"
            href={supportWhatsAppLink("Hola, quiero agendar una sesión de configuración guiada de mi agente")}
          />
        </div>
      </section>
    </div>
  );
}

async function BusinessOverview({ businessId, role, now }: { businessId: string; role: string; now: Date }) {
  const todayStart = startOfTodayBogota(now);
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

  const [business, recentConversations, messagesToday, newContactsToday, upcoming, counts, owner] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { agent: { select: { enabled: true, systemPrompt: true } } },
    }),
    prisma.conversation.findMany({
      where: { businessId, lastMessageAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      orderBy: { lastMessageAt: "desc" },
      take: 300,
      select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { role: true } } },
    }),
    prisma.message.count({ where: { conversation: { businessId }, role: "CUSTOMER", createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { businessId, createdAt: { gte: todayStart } } }),
    prisma.conversation.findMany({
      where: { businessId, appointmentAt: { gte: now, lte: weekAhead } },
      orderBy: { appointmentAt: "asc" },
      take: 3,
      select: { id: true, customerName: true, customerPhone: true, appointmentAt: true },
    }),
    Promise.all([
      prisma.agentMedia.count({ where: { businessId } }),
      prisma.website.count({ where: { businessId } }),
      prisma.messageTemplate.count({ where: { businessId, status: "APPROVED" } }),
      prisma.conversation.count({ where: { businessId } }),
      prisma.membership.count({ where: { businessId, role: "MEMBER" } }),
    ]),
    prisma.membership.findFirst({ where: { businessId, role: "OWNER" }, select: { userId: true } }),
  ]);
  const [mediaCount, websiteCount, approvedTemplates, totalContacts, teamMembers] = counts;
  const awaitingReply = recentConversations.filter((c) => c.messages[0]?.role === "CUSTOMER").length;
  const canSeePlan = role !== "MEMBER";
  const base = `/dashboard/businesses/${businessId}`;

  const agentOn = business.agent?.enabled ?? false;
  const connected = !!business.wabaPhoneNumberId && !!business.wabaAccessToken;
  const healthy = connected && business.whatsappHealthOk !== false;

  const steps = [
    { done: connected, title: "Conecta tu WhatsApp", body: "Pega el Phone Number ID y el token de Meta.", href: `${base}#whatsapp`, cta: "Conectar" },
    {
      done: (business.agent?.systemPrompt?.trim().length ?? 0) >= 120,
      title: "Entrena a tu agente",
      body: "Cuéntale a la IA qué vendes, precios y cómo responder.",
      href: `${base}#instrucciones`,
      cta: "Escribir instrucciones",
    },
    { done: mediaCount > 0, title: "Sube fotos o tu catálogo", body: "La IA podrá enviarlos cuando un cliente los pida.", href: `${base}#catalogo`, cta: "Subir archivos" },
    { done: websiteCount > 0, title: "Crea tu página web", body: "Una landing hecha con IA que lleva clientes a tu WhatsApp.", href: `${base}/website`, cta: "Crear página" },
    {
      done: approvedTemplates > 0,
      title: "Crea una plantilla",
      body: "Para escribirle a clientes después de 24 h y enviar difusiones.",
      href: `${base}/templates`,
      cta: "Crear plantilla",
    },
    { done: totalContacts > 0, title: "Recibe o importa tus clientes", body: "Que te escriban, o importa tu base desde el CRM.", href: `${base}/crm?tab=list`, cta: "Ir al CRM" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <>
      {canSeePlan && <PlanLimitAlert businessId={businessId} ownerUserId={owner?.userId ?? null} planTier={business.planTier} />}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          href={`${base}/crm?tab=chat`}
          label="Sin responder"
          value={awaitingReply}
          hint={awaitingReply === 0 ? "Todo al día" : "Clientes esperando respuesta"}
          tone={awaitingReply > 0 ? "warn" : "ok"}
        />
        <SummaryTile href={`${base}/crm?tab=chat`} label="Mensajes hoy" value={messagesToday} hint="Escritos por tus clientes" />
        <SummaryTile href={`${base}/crm?tab=list`} label="Contactos nuevos hoy" value={newContactsToday} hint={`${totalContacts.toLocaleString("es-CO")} en total`} />
        <Link href={base} className="fl-card fl-card-interactive flex flex-col justify-between gap-2 p-4">
          <span className="text-xs font-medium text-ink-muted">Tu agente</span>
          <span className="flex items-center gap-2 text-lg font-bold text-ink">
            <span className={`h-2.5 w-2.5 rounded-full ${agentOn && healthy ? "bg-accent" : "animate-pulse bg-error"}`} />
            {!connected ? "Sin conectar" : !agentOn ? "Apagado" : healthy ? "Activo" : "Revisar"}
          </span>
          <span className="text-[13px] text-ink-faint">
            {!connected ? "Conecta tu WhatsApp" : !agentOn ? "La IA no está respondiendo" : healthy ? "Respondiendo 24/7" : "Hay un problema de conexión"}
          </span>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="fl-card space-y-4 p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">{progress === 100 ? "¡Tu agente está listo! 🎉" : "Primeros pasos"}</h2>
              <p className="text-xs text-ink-muted">
                {progress === 100 ? "Completaste toda la configuración." : `${doneCount} de ${steps.length} completados — termina para vender más.`}
              </p>
            </div>
            <ProgressRing value={progress} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li
                key={s.title}
                className={`flex items-start gap-3 rounded-lg border p-3 ${s.done ? "border-border bg-surface-2/50" : "border-border-strong"}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[13px] font-bold ${
                    s.done ? "bg-accent text-accent-ink" : "border-2 border-border-strong text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.done ? "text-ink-muted line-through decoration-ink-faint" : "text-ink"}`}>{s.title}</p>
                  {!s.done && (
                    <>
                      <p className="text-xs text-ink-muted">{s.body}</p>
                      <Link href={s.href} className="mt-1 inline-block text-xs font-semibold text-accent hover:underline">
                        {s.cta} →
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {canSeePlan && (
            <PlanCard
              businessId={businessId}
              ownerUserId={owner?.userId ?? null}
              planTier={business.planTier}
              startedAt={business.subscriptionStartedAt}
              endsAt={business.subscriptionEndsAt}
              teamMembers={teamMembers}
              now={now}
            />
          )}
          <section className="fl-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">Próximas citas</h2>
            {upcoming.length === 0 ? (
              <p className="text-xs text-ink-muted">No hay citas en los próximos 7 días.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/crm?tab=chat&conv=${c.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-accent">
                      <span className="truncate text-ink">{contactLabel(c.customerName, c.customerPhone)}</span>
                      <span className="flex-none text-xs text-ink-muted">{formatShort(c.appointmentAt!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// Upsell at the moment it matters: from 80% of the month's contacts, and
// louder at 100% (the agent stops answering NEW contacts until more
// capacity is added — see the plan check in lib/agent.ts).
async function PlanLimitAlert({
  businessId,
  ownerUserId,
  planTier,
}: {
  businessId: string;
  ownerUserId: string | null;
  planTier: keyof typeof PLAN_LIMITS;
}) {
  const base = PLAN_LIMITS[planTier];
  if (base === null) return null;
  const [contacts, addons] = await Promise.all([
    ownerUserId ? getAccountActiveContactsThisMonth(ownerUserId) : getActiveContactsThisMonth(businessId),
    ownerUserId ? getAccountAddonCapacity(ownerUserId) : Promise.resolve({ extraContacts: 0 }),
  ]);
  const limit = base + addons.extraContacts;
  const ratio = contacts / limit;
  if (ratio < 0.8) return null;
  const full = ratio >= 1;

  return (
    <section
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
        full ? "border-error/50 bg-error/10" : "border-[#fab219]/50 bg-[#fab219]/10"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${full ? "text-error" : "text-ink"}`}>
          {full
            ? `Llegaste al límite: ${contacts.toLocaleString("es-CO")} de ${limit.toLocaleString("es-CO")} contactos este mes`
            : `Vas en ${contacts.toLocaleString("es-CO")} de ${limit.toLocaleString("es-CO")} contactos este mes`}
        </p>
        <p className="text-xs text-ink-muted">
          {full
            ? "Tu agente ya no responde a contactos nuevos. Agrega un paquete y vuelve a responder al instante."
            : "Cuando llegues al límite, tu agente dejará de responder a contactos nuevos. Amplía tu capacidad antes."}
        </p>
      </div>
      <div className="flex-none">
        <AddonStore
          businessId={businessId}
          kind="CONTACTS"
          label="Agregar contactos"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
        />
      </div>
    </section>
  );
}

async function PlanCard({
  businessId,
  ownerUserId,
  planTier,
  startedAt,
  endsAt,
  teamMembers,
  now,
}: {
  businessId: string;
  ownerUserId: string | null;
  planTier: keyof typeof PLAN_LIMITS;
  startedAt: Date | null;
  endsAt: Date | null;
  teamMembers: number;
  now: Date;
}) {
  const [contacts, lines, addons] = await Promise.all([
    ownerUserId ? getAccountActiveContactsThisMonth(ownerUserId) : getActiveContactsThisMonth(businessId),
    ownerUserId ? prisma.membership.count({ where: { userId: ownerUserId, role: "OWNER" } }) : Promise.resolve(1),
    ownerUserId ? getAccountAddonCapacity(ownerUserId) : Promise.resolve({ extraContacts: 0, extraLines: 0, active: [] }),
  ]);
  const active = isSubscriptionActive(endsAt);
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)) : null;
  const totalDays = startedAt && endsAt ? Math.max(1, Math.round((endsAt.getTime() - startedAt.getTime()) / DAY_MS)) : null;
  // Plan + active packs — the same totals the agent enforces.
  const baseContacts = PLAN_LIMITS[planTier];
  const contactLimit = baseContacts === null ? null : baseContacts + addons.extraContacts;
  const baseLines = LINE_LIMITS[planTier];
  const lineLimit = baseLines === null ? null : baseLines + addons.extraLines;
  const contactRatio = contactLimit ? contacts / contactLimit : 0;

  return (
    <section className="fl-card-hero space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Plan {PLAN_LABELS[planTier]}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${active ? "bg-accent/15 text-accent" : "bg-error/15 text-error"}`}>
          {active ? "Activo" : "Vencido"}
        </span>
      </div>
      {daysLeft !== null && (
        <UsageBar
          label="Días restantes"
          value={`${daysLeft}`}
          percent={totalDays ? Math.min(100, (daysLeft / totalDays) * 100) : 100}
          tone={daysLeft <= 5 ? "warn" : "ok"}
        />
      )}
      <UsageBar
        label="Contactos activos este mes"
        value={`${contacts.toLocaleString("es-CO")} / ${contactLimit?.toLocaleString("es-CO") ?? "∞"}`}
        percent={contactLimit ? contactRatio * 100 : 0}
        tone={contactRatio >= 0.8 ? "warn" : "ok"}
      />
      <UsageBar
        label="Líneas de WhatsApp"
        value={`${lines} / ${lineLimit ?? "∞"}`}
        percent={lineLimit ? (lines / lineLimit) * 100 : 0}
      />
      <UsageBar
        label="Miembros del equipo"
        value={`${teamMembers} / ${TEAM_MEMBER_LIMITS[planTier] ?? "∞"}`}
        percent={TEAM_MEMBER_LIMITS[planTier] ? (teamMembers / TEAM_MEMBER_LIMITS[planTier]!) * 100 : 0}
      />
      {addons.active.length > 0 && (
        <div className="space-y-1 rounded-lg border border-accent/30 bg-accent/5 p-2.5">
          <p className="text-xs font-semibold text-accent">Paquetes activos</p>
          {addons.active.map((a) => (
            <p key={a.id} className="flex justify-between gap-2 text-xs text-ink-muted">
              <span>{findPack(a.packKey)?.title ?? `+${a.quantity}`}</span>
              <span>
                vence{" "}
                {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(a.expiresAt)}
              </span>
            </p>
          ))}
        </div>
      )}
      {contactLimit !== null && <AddonStore businessId={businessId} label="Comprar más contactos" />}
      <a
        href={supportWhatsAppLink(active ? "Hola, quiero mejorar mi plan de Funnels Labs" : "Hola, quiero renovar mi plan de Funnels Labs")}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md border border-border-strong px-3 py-2 text-center text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
      >
        {active ? "Cambiar de plan" : "Renovar mi plan"}
      </a>
    </section>
  );
}

function UsageBar({ label, value, percent, tone = "ok" }: { label: string; value: string; percent: number; tone?: "ok" | "warn" }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="fl-mono font-semibold text-ink">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${tone === "warn" ? "bg-[#fab219]" : "bg-accent"}`}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function SummaryTile({
  href,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Link href={href} className="fl-card fl-card-interactive flex flex-col justify-between gap-2 p-4">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className={`text-2xl font-bold ${tone === "warn" ? "text-[#fab219]" : "text-ink"}`}>{value.toLocaleString("es-CO")}</span>
      <span className="text-[13px] text-ink-faint">{hint}</span>
    </Link>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="flex-none" role="img" aria-label={`${value}% completado`}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">
        {value}%
      </text>
    </svg>
  );
}

function HelpCard({ icon, title, body, cta, href }: { icon: string; title: string; body: string; cta: string; href: string }) {
  return (
    <div className="fl-card flex gap-4 p-4">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent/15 text-lg" aria-hidden="true">
        {icon}
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink-muted">{body}</p>
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block pt-1 text-xs font-semibold text-accent hover:underline">
          {cta} →
        </a>
      </div>
    </div>
  );
}
