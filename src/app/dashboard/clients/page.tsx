import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin } from "@/lib/authz";
import { findPack } from "@/lib/addonPacks";
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICE_USD, TEAM_MEMBER_LIMITS, LINE_LIMITS } from "@/lib/plans";
import { CreateClientForm } from "./CreateClientForm";
import { EmailCheckButton } from "./EmailCheckButton";
import { ClientsList, type ClientRow } from "./ClientsList";

const DAY_MS = 86_400_000;

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const adminMemberships = await prisma.membership.findMany({
    where: { userId: session.user.id, role: "ADMIN" },
    select: { businessId: true },
  });
  if (adminMemberships.length === 0 && !(await isAgencyAdmin(session.user.id))) notFound();
  const businessIds = adminMemberships.map((m) => m.businessId);

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [owners, contactRows, activityRows, teamRows, websiteRows] = await Promise.all([
    prisma.membership.findMany({
      // The agency's own account isn't a client.
      where: { businessId: { in: businessIds }, role: "OWNER", userId: { not: session.user.id } },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            country: true,
            monthlyPriceUsd: true,
            activationRequired: true,
            trialCheckoutAt: true,
            mpPreapprovalId: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
            planTier: true,
            subscriptionStartedAt: true,
            subscriptionEndsAt: true,
            wabaPhoneNumberId: true,
            wabaAccessToken: true,
          },
        },
      },
    }),
    prisma.$queryRaw<{ businessId: string; contacts: bigint }[]>`
      SELECT c."businessId", COUNT(DISTINCT m."conversationId") AS "contacts"
      FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
      WHERE c."businessId" IN (${Prisma.join(businessIds)}) AND m."role" = 'CUSTOMER' AND m."createdAt" >= ${startOfMonth}
      GROUP BY c."businessId"`,
    prisma.$queryRaw<{ businessId: string; last: Date }[]>`
      SELECT c."businessId", MAX(m."createdAt") AS "last"
      FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
      WHERE c."businessId" IN (${Prisma.join(businessIds)})
      GROUP BY c."businessId"`,
    prisma.membership.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds }, role: "MEMBER" }, _count: true }),
    prisma.website.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true }),
  ]);

  const userIds = [...new Set(owners.map((o) => o.user.id))];
  const emails = [...new Set(owners.map((o) => o.user.email.toLowerCase()))];
  const [activeAddons, payments] = await Promise.all([
    prisma.accountAddon.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.paymentEvent.findMany({
      where: { email: { in: emails }, action: "grant" },
      orderBy: { createdAt: "desc" },
      select: { email: true, createdAt: true, provider: true },
    }),
  ]);

  const contactsBy = new Map(contactRows.map((r) => [r.businessId, Number(r.contacts)]));
  const activityBy = new Map(activityRows.map((r) => [r.businessId, r.last]));
  const teamBy = new Map(teamRows.map((r) => [r.businessId, r._count]));
  const websitesBy = new Map(websiteRows.map((r) => [r.businessId, r._count]));
  const lastPaymentBy = new Map<string, { at: Date; provider: string }>();
  for (const p of payments) if (!lastPaymentBy.has(p.email)) lastPaymentBy.set(p.email, { at: p.createdAt, provider: p.provider });

  // One row per client account (an owner can run several WhatsApp lines).
  const rows = new Map<string, ClientRow>();
  for (const { user, business, createdAt } of owners) {
    let row = rows.get(user.id);
    if (!row) {
      row = {
        userId: user.id,
        name: user.name ?? business.name,
        email: user.email,
        phone: user.phone,
        location: [user.city, user.country].filter(Boolean).join(", ") || null,
        joinedAt: createdAt.toISOString(),
        pendingCard: user.activationRequired,
        checkoutOpenedAt: user.trialCheckoutAt?.toISOString() ?? null,
        cardOnFile: !!user.mpPreapprovalId,
        planTier: business.planTier,
        planLabel: PLAN_LABELS[business.planTier],
        priceUsd: user.monthlyPriceUsd ?? PLAN_PRICE_USD[business.planTier],
        customPrice: user.monthlyPriceUsd !== null,
        endsAt: null,
        startedAt: null,
        contacts: 0,
        contactLimit: PLAN_LIMITS[business.planTier],
        lineLimit: LINE_LIMITS[business.planTier],
        teamLimit: TEAM_MEMBER_LIMITS[business.planTier],
        team: 0,
        websites: 0,
        lastActivity: null,
        lastPayment: lastPaymentBy.get(user.email.toLowerCase())?.at.toISOString() ?? null,
        paymentProvider: lastPaymentBy.get(user.email.toLowerCase())?.provider === "hotmart" ? "Hotmart" : "Mercado Pago",
        lines: [],
        addons: (activeAddons.filter((a) => a.userId === user.id)).map((a) => ({
          id: a.id,
          title: findPack(a.packKey)?.title ?? a.packKey,
          expiresAt: a.expiresAt ? a.expiresAt.toISOString() : "",
          quantity: a.quantity,
          kind: a.kind,
        })),
      };
      rows.set(user.id, row);
    }
    if (new Date(row.joinedAt) > createdAt) row.joinedAt = createdAt.toISOString();
    const last = activityBy.get(business.id);
    if (last && (!row.lastActivity || last.toISOString() > row.lastActivity)) row.lastActivity = last.toISOString();
    if (business.subscriptionEndsAt && (!row.endsAt || business.subscriptionEndsAt.toISOString() > row.endsAt)) row.endsAt = business.subscriptionEndsAt.toISOString();
    if (business.subscriptionStartedAt && (!row.startedAt || business.subscriptionStartedAt.toISOString() < row.startedAt)) row.startedAt = business.subscriptionStartedAt.toISOString();
    row.contacts += contactsBy.get(business.id) ?? 0;
    row.team += teamBy.get(business.id) ?? 0;
    row.websites += websitesBy.get(business.id) ?? 0;
    row.lines.push({
      businessId: business.id,
      name: business.name,
      whatsappConnected: !!(business.wabaPhoneNumberId && business.wabaAccessToken),
      startedAt: business.subscriptionStartedAt?.toISOString() ?? null,
      endsAt: business.subscriptionEndsAt?.toISOString() ?? null,
    });
  }
  // Packs add capacity on top of the plan.
  for (const row of rows.values()) {
    if (row.contactLimit !== null) row.contactLimit += row.addons.filter((a) => a.kind === "CONTACTS").reduce((s, a) => s + a.quantity, 0);
  }

  const all = [...rows.values()];
  // Signed up but never registered a card: leads for the sales team, not
  // clients yet (no access, no revenue).
  const list = all.filter((r) => !r.pendingCard);
  const pending = all.filter((r) => r.pendingCard);
  // Negative (or -0.x) once the end has passed: expired, even if only by minutes.
  const daysLeft = (iso: string | null) => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - now.getTime();
    return diff <= 0 ? -1 : Math.ceil(diff / DAY_MS);
  };
  const summary = {
    total: list.length,
    pending: pending.length,
    active: list.filter((r) => (daysLeft(r.endsAt) ?? 1) > 7).length,
    expiring: list.filter((r) => {
      const d = daysLeft(r.endsAt);
      return d !== null && d >= 0 && d <= 7;
    }).length,
    expired: list.filter((r) => (daysLeft(r.endsAt) ?? 0) < 0).length,
    mrr: list.filter((r) => (daysLeft(r.endsAt) ?? 1) >= 0).reduce((s, r) => s + r.priceUsd, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Quién te paga, hasta cuándo y cómo usa la plataforma. Las membresías se activan y renuevan solas con cada pago de Mercado Pago.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <EmailCheckButton />
          <CreateClientForm />
        </div>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6">
        {[
          { label: "Clientes", value: summary.total.toLocaleString("es-CO"), hint: "Con tarjeta o activados" },
          { label: "Sin tarjeta", value: summary.pending.toLocaleString("es-CO"), hint: "Se registraron, falta cerrarlos", tone: summary.pending ? "text-accent" : "" },
          { label: "Activos", value: summary.active.toLocaleString("es-CO"), hint: "Con membresía al día", tone: "text-[var(--status-good)]" },
          { label: "Por vencer", value: summary.expiring.toLocaleString("es-CO"), hint: "En los próximos 7 días", tone: summary.expiring ? "text-[var(--status-warn)]" : "" },
          { label: "Vencidos", value: summary.expired.toLocaleString("es-CO"), hint: "Sin acceso al panel", tone: summary.expired ? "text-[var(--status-bad)]" : "" },
          { label: "Ingreso / mes", value: `US$${summary.mrr.toLocaleString("es-CO")}`, hint: "Clientes activos (aprox.)" },
        ].map((t) => (
          <div key={t.label} className="fl-card p-3 sm:p-4">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted sm:text-xs">{t.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${t.tone ?? "text-ink"}`}>{t.value}</p>
            <p className="hidden text-xs text-ink-muted sm:block">{t.hint}</p>
          </div>
        ))}
      </section>

      <ClientsList rows={all} nowIso={now.toISOString()} supportHost={process.env.APP_HOST ?? "agente.funnelslabs.app"} />
    </div>
  );
}
