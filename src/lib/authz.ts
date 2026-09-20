import { prisma } from "@/lib/prisma";

/**
 * Multi-tenant guard: throws unless the given user belongs to the business.
 * Every server action/route that reads or writes a specific business must
 * call this first — business ids are guessable cuids, not secrets. Any role
 * (including MEMBER, an invited teammate — see inviteTeamMember) passes
 * this check; it's the floor, not the full permission model.
 */
export async function requireBusinessMembership(userId: string, businessId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });

  if (!membership) {
    throw new Error("Not authorized for this business");
  }
}

/**
 * Stricter guard for sensitive, business-wide settings — WhatsApp
 * credentials, AI agent configuration, the media library the agent can send
 * from, deleting the business, managing the team. An invited MEMBER (see
 * inviteTeamMember in lib/actions.ts) has full CRM access but is
 * deliberately locked out of all of this.
 */
export async function requireBusinessOwnerOrAdmin(userId: string, businessId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });

  if (!membership || membership.role === "MEMBER") {
    throw new Error("Solo el dueño del negocio o la agencia pueden hacer esto");
  }
}
