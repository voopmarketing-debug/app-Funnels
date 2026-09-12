import { prisma } from "@/lib/prisma";

/**
 * Multi-tenant guard: throws unless the given user belongs to the business.
 * Every server action/route that reads or writes a specific business must
 * call this first — business ids are guessable cuids, not secrets.
 */
export async function requireBusinessMembership(userId: string, businessId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });

  if (!membership) {
    throw new Error("Not authorized for this business");
  }
}
