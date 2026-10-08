"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { findPack } from "@/lib/addonPacks";
import { activateAddon, getBusinessOwnerId } from "@/lib/addons";
import { createMpCheckoutLink } from "@/lib/mercadopago";
import { supportWhatsAppLink } from "@/lib/constants";

export type CheckoutResult = { url: string; kind: "mercadopago" | "static" | "support" };

// Fixed links pasted from the Mercado Pago dashboard, one per pack — the
// fallback while there's no API token, or if creating a per-purchase link
// fails. Payments through these carry no reference to the account, so the
// webhook matches them by amount + the payer's email (see the MP route).
function staticLinkFor(packKey: string): string | null {
  const url = process.env[`MP_LINK_${packKey}`]?.trim();
  return url && /^https:\/\//.test(url) ? url : null;
}

/**
 * Starts buying a pack for the account that owns this business. Prefers a
 * one-off Mercado Pago checkout tied to a PENDING row (activated by the
 * webhook the moment the payment is approved); falls back to the fixed
 * link for that pack, and finally to a WhatsApp message to the agency.
 */
export async function startAddonCheckout(businessId: string, packKey: string): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const pack = findPack(packKey);
  if (!pack || pack.retired) throw new Error("Paquete no encontrado");

  const ownerId = (await getBusinessOwnerId(businessId)) ?? session.user.id;
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { email: true } });

  const addon = await prisma.accountAddon.create({
    data: { userId: ownerId, packKey: pack.key, kind: pack.kind, quantity: pack.quantity, priceCop: pack.priceCop },
  });

  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  const mpUrl = await createMpCheckoutLink({
    title: `Funnels Labs · ${pack.title}`,
    priceCop: pack.priceCop,
    externalReference: `addon:${addon.id}`,
    payerEmail: owner?.email,
    backUrl: `https://${host}/dashboard/businesses/${businessId}?compra=${addon.id}`,
  }).catch(() => null);
  if (mpUrl) return { url: mpUrl, kind: "mercadopago" };

  // Not resumable without the API, so the PENDING row would never be used.
  await prisma.accountAddon.update({ where: { id: addon.id }, data: { status: "CANCELED" } });

  const staticUrl = staticLinkFor(pack.key);
  if (staticUrl) return { url: staticUrl, kind: "static" };

  return {
    url: supportWhatsAppLink(`Hola, quiero comprar el paquete ${pack.title} para mi cuenta (${owner?.email ?? ""}).`),
    kind: "support",
  };
}

/** Agency-only: grant a pack by hand (paid by transfer, courtesy, etc.). */
export async function grantAddonManually(ownerUserId: string, packKey: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireAgencyAdmin(session.user.id);

  const pack = findPack(packKey);
  if (!pack || pack.retired) throw new Error("Paquete no encontrado");

  const addon = await prisma.accountAddon.create({
    data: { userId: ownerUserId, packKey: pack.key, kind: pack.kind, quantity: pack.quantity, priceCop: pack.priceCop, source: "MANUAL" },
  });
  await activateAddon(addon.id);
  revalidatePath("/dashboard", "layout");
}
