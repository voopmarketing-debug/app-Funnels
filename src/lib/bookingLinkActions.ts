"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveAccount, requireBusinessOwnerOrAdmin } from "@/lib/authz";

/**
 * Turns the automatic booking-link follow-up on or off for one business.
 * Returns the error instead of throwing, so the switch can show it.
 */
export async function setAutoBookingLink(businessId: string, enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    await requireBusinessOwnerOrAdmin(session.user.id, businessId);
    // Turning it on spends WhatsApp messages: it needs an account in good standing.
    if (enabled) await requireActiveAccount(session.user.id, businessId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No tienes permiso para hacer esto" };
  }
  await prisma.business.update({ where: { id: businessId }, data: { autoBookingLinkEnabled: enabled } });
  revalidatePath(`/dashboard/businesses/${businessId}/templates`);
  return { ok: true };
}
