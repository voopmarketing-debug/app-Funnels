import { prisma } from "@/lib/prisma";
import { ADDON_DURATION_DAYS, findPack } from "@/lib/addonPacks";

export type AccountAddonCapacity = {
  extraContacts: number;
  extraLines: number;
  active: { id: string; packKey: string; kind: string; quantity: number; expiresAt: Date }[];
};

/** Extra contacts/lines from the account's currently active packs. */
export async function getAccountAddonCapacity(userId: string): Promise<AccountAddonCapacity> {
  const active = await prisma.accountAddon.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { id: true, packKey: true, kind: true, quantity: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
  });
  return {
    extraContacts: active.filter((a) => a.kind === "CONTACTS").reduce((sum, a) => sum + a.quantity, 0),
    extraLines: active.filter((a) => a.kind === "LINE").reduce((sum, a) => sum + a.quantity, 0),
    active: active.map((a) => ({ ...a, expiresAt: a.expiresAt! })),
  };
}

/** The OWNER account behind a business — whose plan and packs apply to it. */
export async function getBusinessOwnerId(businessId: string): Promise<string | null> {
  const owner = await prisma.membership.findFirst({ where: { businessId, role: "OWNER" }, select: { userId: true } });
  return owner?.userId ?? null;
}

/**
 * Flips a pack to ACTIVE for 30 days and tells the client in their bell.
 * Idempotent: Mercado Pago retries webhooks, and a payment id can only ever
 * activate one pack (mpPaymentId is unique).
 */
export async function activateAddon(addonId: string, opts: { mpPaymentId?: string } = {}): Promise<boolean> {
  const addon = await prisma.accountAddon.findUnique({ where: { id: addonId } });
  if (!addon || addon.status !== "PENDING") return false;
  if (opts.mpPaymentId) {
    const already = await prisma.accountAddon.findUnique({ where: { mpPaymentId: opts.mpPaymentId } });
    if (already) return false;
  }

  const now = new Date();
  // Conditional on still being PENDING, so two concurrent webhook deliveries
  // can't both activate (and notify) the same pack.
  const { count } = await prisma.accountAddon.updateMany({
    where: { id: addonId, status: "PENDING" },
    data: {
      status: "ACTIVE",
      activatedAt: now,
      expiresAt: new Date(now.getTime() + ADDON_DURATION_DAYS * 86_400_000),
      mpPaymentId: opts.mpPaymentId ?? null,
    },
  });
  if (count === 0) return false;

  const pack = findPack(addon.packKey);
  const businesses = await prisma.membership.findMany({
    where: { userId: addon.userId, role: "OWNER" },
    select: { businessId: true },
  });

  // Conversations the agent paused because the month's contacts ran out
  // (see logPlanLimitNotice in lib/agent.ts) get the AI back right away —
  // only those: a chat a person paused on purpose has no such notice.
  if (addon.kind === "CONTACTS" && businesses.length > 0) {
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    await prisma.conversation.updateMany({
      where: {
        businessId: { in: businesses.map((b) => b.businessId) },
        aiPaused: true,
        messages: { some: { content: { startsWith: "[LÍMITE DE PLAN]" }, createdAt: { gte: startOfMonth } } },
      },
      data: { aiPaused: false },
    });
  }
  if (businesses.length > 0 && pack) {
    await prisma.notification.createMany({
      data: businesses.map((b) => ({
        businessId: b.businessId,
        type: "ADDON_ACTIVATED",
        message: `✅ Tu paquete ${pack.title} ya está activo por ${ADDON_DURATION_DAYS} días.`,
      })),
    });
  }
  return true;
}
