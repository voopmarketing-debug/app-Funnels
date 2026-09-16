import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveContactsThisMonth } from "@/lib/analytics";
import { PLAN_LIMITS, planUsageStatus } from "@/lib/plans";
import { getAccountLineStatus } from "@/lib/lineLimits";
import { BusinessCardMenu } from "./BusinessCardMenu";
import { NewBusinessButton } from "./NewBusinessButton";

const PLAN_BADGE_STYLES: Record<"warning" | "critical", { bg: string; text: string; label: string }> = {
  warning: { bg: "#fab21926", text: "#fab219", label: "Cerca del límite del plan" },
  critical: { bg: "#d03b3b26", text: "#d03b3b", label: "Superó el límite del plan" },
};

// registerBusiness() only grants the agency an ADMIN membership on a client
// business at the exact moment that business registers, and only if the
// agency's own account already existed by then — so it can miss businesses
// created before AGENCY_ADMIN_EMAIL was configured, or before the agency
// account existed. This runs on every /dashboard load for that one account
// and adopts any business it's missing, so "see every client" always holds
// without needing a one-off DB fix.
async function backfillAgencyAdminMemberships(userId: string, userEmail: string | null | undefined) {
  const agencyAdminEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  if (!agencyAdminEmail || userEmail?.trim().toLowerCase() !== agencyAdminEmail) return;

  const businesses = await prisma.business.findMany({ select: { id: true } });
  if (businesses.length === 0) return;

  await prisma.membership.createMany({
    data: businesses.map((b) => ({ userId, businessId: b.id, role: "ADMIN" as const })),
    skipDuplicates: true,
  });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  await backfillAgencyAdminMemberships(session.user.id, session.user.email);

  const lineStatus = await getAccountLineStatus(session.user.id);

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { business: { include: { agent: true, _count: { select: { conversations: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  // Only the agency (ADMIN) needs the over-limit heads-up here — an OWNER
  // already sees their own plan usage on the business page. Skip the extra
  // queries for businesses where it won't be shown.
  const adminBusinessIds = memberships.filter((m) => m.role === "ADMIN").map((m) => m.business.id);
  const activeContactsEntries = await Promise.all(
    adminBusinessIds.map(async (businessId) => [businessId, await getActiveContactsThisMonth(businessId)] as const),
  );
  const activeContactsByBusiness = new Map(activeContactsEntries);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Negocios</h1>
        <NewBusinessButton
          atLimit={lineStatus.atLimit}
          limit={lineStatus.limit}
          count={lineStatus.count}
          planTier={lineStatus.planTier}
        />
      </div>

      {memberships.length === 0 && (
        <p className="text-ink-muted">
          Todavía no hay negocios. Crea el primero para conectar su WhatsApp.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map(({ business, role }) => {
          const used = activeContactsByBusiness.get(business.id);
          const status = role === "ADMIN" && used !== undefined
            ? planUsageStatus(used, PLAN_LIMITS[business.planTier])
            : null;
          const badge = status === "warning" || status === "critical" ? PLAN_BADGE_STYLES[status] : null;

          return (
            <li key={business.id} className="relative">
              <Link
                href={`/dashboard/businesses/${business.id}`}
                className="fl-card fl-card-hover fl-card-interactive block p-4"
              >
                <div className="flex items-start justify-between gap-2 pr-7">
                  <p className="font-medium">{business.name}</p>
                  {badge && (
                    <span
                      className="fl-mono flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: badge.bg, color: badge.text }}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${business.agent?.enabled ? "bg-accent shadow-[0_0_8px_rgba(181,255,43,0.8)]" : "bg-ink-faint"}`}
                  />
                  Agente {business.agent?.enabled ? "activo" : "inactivo"}
                </p>
                <p className="text-sm text-ink-muted">
                  {business._count.conversations} conversaciones
                </p>
              </Link>
              <BusinessCardMenu businessId={business.id} currentName={business.name} canRename={role === "ADMIN"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
