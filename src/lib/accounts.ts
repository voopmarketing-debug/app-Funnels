import { prisma } from "@/lib/prisma";

/**
 * Deletes a login that no longer has anything attached to it — no
 * business (as owner, teammate or agency admin), no Mercado Pago
 * subscription and no purchased packs — so its email can be used again.
 * This is what's left behind when a client's last business is deleted.
 * Returns true when the email is free afterwards.
 */
export async function releaseOrphanAccount(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, mpPreapprovalId: true, _count: { select: { memberships: true, addons: true } } },
  });
  if (!user) return true;
  const agencyEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  const orphan = user._count.memberships === 0 && user._count.addons === 0 && !user.mpPreapprovalId && normalized !== agencyEmail;
  if (!orphan) return false;
  // Only deletes if it's still an orphan at this exact moment.
  const { count } = await prisma.user.deleteMany({
    where: { id: user.id, memberships: { none: {} }, addons: { none: {} }, mpPreapprovalId: null },
  });
  return count === 1;
}
