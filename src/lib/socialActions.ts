"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireBusinessMembership, requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { listAdAccounts, listPages } from "@/lib/metaSocial";
import { clearSocialCache } from "@/lib/socialDashboard";

async function userId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Inicia sesión de nuevo");
  return session.user.id;
}

/**
 * Saves which Facebook Page (with its Instagram) and which ad account this
 * business reports on. The Page token is read again from Meta here, never
 * taken from the browser.
 */
export async function selectSocialAccounts(
  businessId: string,
  pageId: string | null,
  adAccountId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  const connection = await prisma.socialConnection.findUnique({ where: { businessId } });
  if (!connection?.userAccessToken) return { ok: false, error: "Conecta tu cuenta de Facebook primero" };
  const token = decryptSecret(connection.userAccessToken);
  try {
    const [pages, adAccounts] = await Promise.all([pageId ? listPages(token) : [], adAccountId ? listAdAccounts(token) : []]);
    const page = pageId ? pages.find((p) => p.id === pageId) : null;
    const ad = adAccountId ? adAccounts.find((a) => a.id === adAccountId) : null;
    if (pageId && !page) return { ok: false, error: "Esa página ya no aparece en tu cuenta de Facebook" };
    if (adAccountId && !ad) return { ok: false, error: "Esa cuenta publicitaria ya no aparece en tu Facebook" };
    await prisma.socialConnection.update({
      where: { businessId },
      data: {
        fbPageId: page?.id ?? null,
        fbPageName: page?.name ?? null,
        pageAccessToken: page ? encryptSecret(page.accessToken) : null,
        igUserId: page?.igUserId ?? null,
        igUsername: page?.igUsername ?? null,
        adAccountId: ad?.id ?? null,
        adAccountName: ad?.name ?? null,
        adCurrency: ad?.currency ?? null,
      },
    });
  } catch (err) {
    console.error("[social] select accounts failed", err);
    return { ok: false, error: "Meta no respondió. Intenta de nuevo en un momento." };
  }
  await clearSocialCache(businessId, true);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
  return { ok: true };
}

export async function refreshSocialData(businessId: string): Promise<{ ok: boolean }> {
  await requireBusinessMembership(await userId(), businessId);
  const cleared = await clearSocialCache(businessId);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
  return { ok: cleared };
}

export async function disconnectSocial(businessId: string): Promise<void> {
  await requireBusinessOwnerOrAdmin(await userId(), businessId);
  await prisma.socialConnection.deleteMany({ where: { businessId } });
  await clearSocialCache(businessId, true);
  revalidatePath(`/dashboard/businesses/${businessId}/redes`);
}
