import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TEAM_MEMBER_LIMITS } from "@/lib/plans";
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Mi perfil</h1>
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
      <ChangePasswordForm />
      <TeamMembersManager businesses={teamBusinesses} />
    </div>
  );
}
