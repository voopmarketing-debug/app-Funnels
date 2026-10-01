"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AGENT_MODELS } from "@/lib/plans";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdminOf(businessIds: string[]): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Tu sesión expiró, vuelve a iniciar sesión");
  const count = await prisma.membership.count({
    where: { userId: session.user.id, role: "ADMIN", businessId: { in: businessIds } },
  });
  if (businessIds.length === 0 || count !== businessIds.length) throw new Error("Solo la agencia puede hacer esto");
  return session.user.id;
}

/** Agency-only: which Claude model answers this line's WhatsApp messages. */
export async function setAgentModel(businessId: string, model: string): Promise<Result> {
  try {
    await requireAdminOf([businessId]);
    if (!AGENT_MODELS.some((m) => m.id === model)) return { ok: false, error: "Modelo no válido" };
    await prisma.aIAgent.update({ where: { businessId }, data: { model } });
    revalidatePath("/dashboard/rentabilidad");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo cambiar el modelo" };
  }
}

/**
 * Agency-only: the price this account really pays per month (launch offer,
 * negotiated deal). null goes back to the plan's list price.
 */
export async function setAccountMonthlyPrice(userId: string, priceUsd: number | null): Promise<Result> {
  try {
    const owned = await prisma.membership.findMany({ where: { userId, role: "OWNER" }, select: { businessId: true } });
    await requireAdminOf(owned.map((m) => m.businessId));
    if (priceUsd !== null && (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 100_000)) {
      return { ok: false, error: "Escribe un precio válido en USD" };
    }
    await prisma.user.update({ where: { id: userId }, data: { monthlyPriceUsd: priceUsd } });
    revalidatePath("/dashboard/rentabilidad");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar el precio" };
  }
}
