import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LABELS, TEAM_MEMBER_LIMITS } from "@/lib/plans";
import { PushSettingsCard } from "../PushNotifications";
import { AccountForm } from "./AccountForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { TeamMembersManager, type TeamBusiness } from "./TeamMembersManager";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  // Only businesses this user actually owns — an agency ADMIN manages many
  // client businesses and shouldn't see every client's sales team dumped
  // onto their own personal profile page.
  const ownedMemberships = await prisma.membership.findMany({
    where: { userId: session.user.id, role: "OWNER" },
    include: { business: { select: { id: true, name: true, planTier: true } } },
    orderBy: { createdAt: "asc" },
  });

  const teamBusinesses: TeamBusiness[] = await Promise.all(
    ownedMemberships.map(async (m) => {
      const members = await prisma.membership.findMany({
        where: { businessId: m.business.id, role: "MEMBER" },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return {
        businessId: m.business.id,
        businessName: m.business.name,
        limit: TEAM_MEMBER_LIMITS[m.business.planTier],
        members: members.map((mm) => ({ userId: mm.user.id, name: mm.user.name, email: mm.user.email })),
      };
    }),
  );

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const sinceRaw = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "America/Bogota" }).format(user.createdAt);
  const memberSince = sinceRaw.charAt(0).toUpperCase() + sinceRaw.slice(1);
  const businessCount = ownedMemberships.length;
  const planLabel = ownedMemberships[0] ? PLAN_LABELS[ownedMemberships[0].business.planTier] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="fl-card flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-accent/15 text-lg font-bold text-accent">
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-ink">{user.name || "Mi perfil"}</h1>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
        </div>
        <dl className="flex flex-wrap gap-2 text-xs">
          {planLabel && (
            <div className="rounded-lg border border-border px-3 py-1.5">
              <dt className="text-ink-muted">Plan</dt>
              <dd className="font-semibold text-ink">{planLabel}</dd>
            </div>
          )}
          <div className="rounded-lg border border-border px-3 py-1.5">
            <dt className="text-ink-muted">Agentes</dt>
            <dd className="font-semibold text-ink">{businessCount}</dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-1.5">
            <dt className="text-ink-muted">Cliente desde</dt>
            <dd className="font-semibold text-ink">{memberSince}</dd>
          </div>
        </dl>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AccountForm
            email={user.email}
            name={user.name ?? ""}
            phone={user.phone ?? ""}
            city={user.city ?? ""}
            country={user.country ?? ""}
            facebook={user.facebook ?? ""}
            instagram={user.instagram ?? ""}
            tiktok={user.tiktok ?? ""}
            linkedin={user.linkedin ?? ""}
          />
          {teamBusinesses.length > 0 && <TeamMembersManager businesses={teamBusinesses} />}
        </div>
        <aside className="space-y-6">
          <PushSettingsCard />
          <ChangePasswordForm />
        </aside>
      </div>
    </div>
  );
}
