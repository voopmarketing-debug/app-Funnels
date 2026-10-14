import { Prisma, type PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin } from "@/lib/authz";
import { findPack } from "@/lib/addonPacks";
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICE_USD, TEAM_MEMBER_LIMITS, LINE_LIMITS, TRIAL_DAYS } from "@/lib/plans";
import { RENEWAL_GRACE_DAYS } from "@/lib/hotmart";

// The agency's client accounts, one row per owner (an owner can run several
// WhatsApp lines): membership dates, how it's paid (trial / paid / manual),
// usage and activity. Shared by the Clientes page and the Asistente
// Funnels' agency mode.

const DAY_MS = 86_400_000;
// A free-trial grant covers TRIAL_DAYS + grace (10 days); a paid one, a month.
// Anything this short that came from a card sign-up is the trial.
const TRIAL_SPAN_MS = (TRIAL_DAYS + RENEWAL_GRACE_DAYS + 5) * DAY_MS;

export type ClientRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  joinedAt: string;
  // Signed up on their own but never registered a card (see /activar).
  pendingCard: boolean;
  // When they last went to Mercado Pago from /activar without finishing.
  checkoutOpenedAt: string | null;
  // A Mercado Pago subscription is linked to the account.
  cardOnFile: boolean;
  planTier: PlanTier;
  planLabel: string;
  priceUsd: number;
  customPrice: boolean;
  startedAt: string | null;
  endsAt: string | null;
  contacts: number;
  contactLimit: number | null;
  lineLimit: number | null;
  teamLimit: number | null;
  team: number;
  websites: number;
  lastActivity: string | null;
  lastPayment: string | null;
  paymentProvider: string;
  // How the current period is covered: a free trial (card on file, no charge
  // yet), a real payment, or dates the agency set by hand.
  billing: "trial" | "paid" | "manual";
  // During the trial: when Mercado Pago makes the first charge.
  trialChargeAt: string | null;
  lines: { businessId: string; name: string; whatsappConnected: boolean; startedAt: string | null; endsAt: string | null }[];
  addons: { id: string; title: string; expiresAt: string; quantity: number; kind: string }[];
};

/** null when this person isn't the agency. */
export async function getClientRows(adminUserId: string, now = new Date()): Promise<ClientRow[] | null> {
  const adminMemberships = await prisma.membership.findMany({
    where: { userId: adminUserId, role: "ADMIN" },
    select: { businessId: true },
  });
  if (adminMemberships.length === 0 && !(await isAgencyAdmin(adminUserId))) return null;
  const businessIds = adminMemberships.map((m) => m.businessId);

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [owners, contactRows, activityRows, teamRows, websiteRows] = await Promise.all([
    prisma.membership.findMany({
      // The agency's own account isn't a client.
      where: { businessId: { in: businessIds }, role: "OWNER", userId: { not: adminUserId } },
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
    // Prisma.join throws on an empty list: the agency with no clients yet.
    businessIds.length
      ? prisma.$queryRaw<{ businessId: string; contacts: bigint }[]>`
          SELECT c."businessId", COUNT(DISTINCT m."conversationId") AS "contacts"
          FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
          WHERE c."businessId" IN (${Prisma.join(businessIds)}) AND m."role" = 'CUSTOMER' AND m."createdAt" >= ${startOfMonth}
          GROUP BY c."businessId"`
      : [],
    businessIds.length
      ? prisma.$queryRaw<{ businessId: string; last: Date }[]>`
          SELECT c."businessId", MAX(m."createdAt") AS "last"
          FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
          WHERE c."businessId" IN (${Prisma.join(businessIds)})
          GROUP BY c."businessId"`
      : [],
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
      select: { email: true, createdAt: true, provider: true, transaction: true },
    }),
  ]);

  const contactsBy = new Map(contactRows.map((r) => [r.businessId, Number(r.contacts)]));
  const activityBy = new Map(activityRows.map((r) => [r.businessId, r.last]));
  const teamBy = new Map(teamRows.map((r) => [r.businessId, r._count]));
  const websitesBy = new Map(websiteRows.map((r) => [r.businessId, r._count]));
  const grantsBy = new Map<string, typeof payments>();
  for (const p of payments) grantsBy.set(p.email, [...(grantsBy.get(p.email) ?? []), p]);

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
        lastPayment: null,
        paymentProvider: "Mercado Pago",
        billing: "manual",
        trialChargeAt: null,
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
  for (const row of rows.values()) {
    // The card sign-up (preapproval) only opens the free trial: the first real
    // charge is a later payment. So the trial is the latest grant when it's
    // that sign-up and it only covered the trial's few days.
    const grants = grantsBy.get(row.email.toLowerCase()) ?? [];
    const latest = grants[0];
    // (A card linked with no recorded charge at all is the same trial.)
    const trialStart = latest ? (latest.transaction.startsWith("preapproval:") ? latest.createdAt : null) : row.cardOnFile && row.startedAt ? new Date(row.startedAt) : null;
    const onTrial = !!trialStart && !!row.endsAt && new Date(row.endsAt).getTime() - trialStart.getTime() <= TRIAL_SPAN_MS;
    const paid = onTrial ? grants.slice(1) : grants;
    if (onTrial) {
      row.billing = "trial";
      row.trialChargeAt = new Date(new Date(row.endsAt!).getTime() - RENEWAL_GRACE_DAYS * DAY_MS).toISOString();
    } else if (paid.length) {
      row.billing = "paid";
    }
    if (paid[0]) {
      row.lastPayment = paid[0].createdAt.toISOString();
      row.paymentProvider = paid[0].provider === "hotmart" ? "Hotmart" : "Mercado Pago";
    }
    // Packs add capacity on top of the plan.
    if (row.contactLimit !== null) row.contactLimit += row.addons.filter((a) => a.kind === "CONTACTS").reduce((s, a) => s + a.quantity, 0);
  }


  return [...rows.values()];
}
