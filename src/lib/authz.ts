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

/**
 * The agency (Funnels Labs itself): the AGENCY_ADMIN_EMAIL account, plus
 * whoever holds an ADMIN membership on any business. The email check keeps
 * the agency account the agency even with no clients left (e.g. after
 * deleting every test client), when it only OWNs its own business —
 * otherwise Clientes/Rentabilidad/Novedades vanished with the last client.
 * Platform-wide content like announcements is gated on this, not on any
 * single business.
 */
export async function isAgencyAdmin(userId: string): Promise<boolean> {
  const admin = await prisma.membership.findFirst({ where: { userId, role: "ADMIN" }, select: { id: true } });
  if (admin) return true;
  const agencyEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  if (!agencyEmail) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email.trim().toLowerCase() === agencyEmail;
}

export async function requireAgencyAdmin(userId: string): Promise<void> {
  if (!(await isAgencyAdmin(userId))) throw new Error("Solo la agencia puede hacer esto");
}
