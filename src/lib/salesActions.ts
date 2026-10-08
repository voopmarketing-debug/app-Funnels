"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin } from "@/lib/authz";

/**
 * The sales team closed a sign-up that never registered a card (paid by
 * transfer, a deal, a demo…): give them access for `days` without going
 * through Mercado Pago. Only lines the agency manages are touched.
 */
export async function activateWithoutCard(userId: string, days: number): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Inicia sesión de nuevo" };
  try {
    await requireAgencyAdmin(session.user.id);
  } catch {
    return { ok: false, error: "Solo la agencia puede hacer esto" };
  }
  if (!Number.isInteger(days) || days < 1 || days > 366) return { ok: false, error: "Días inválidos" };

  const managed = await prisma.membership.findMany({ where: { userId: session.user.id, role: "ADMIN" }, select: { businessId: true } });
  const owned = await prisma.membership.findMany({
    where: { userId, role: "OWNER", businessId: { in: managed.map((m) => m.businessId) } },
    select: { business: { select: { id: true, subscriptionStartedAt: true } } },
  });
  if (owned.length === 0) return { ok: false, error: "Esta cuenta no tiene negocios que administres" };

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 86_400_000);
  await prisma.$transaction([
    ...owned.map(({ business }) =>
      prisma.business.update({
        where: { id: business.id },
        data: { subscriptionEndsAt: endsAt, ...(business.subscriptionStartedAt ? {} : { subscriptionStartedAt: now }) },
      }),
    ),
    prisma.user.update({ where: { id: userId }, data: { activationRequired: false } }),
  ]);
  revalidatePath("/dashboard/clients");
  return { ok: true };
}
