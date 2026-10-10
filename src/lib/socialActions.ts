"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireBusinessMembership, requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { listAdAccounts, listPages } from "@/lib/metaSocial";
import { sendReply } from "@/lib/metaInbox";
import { clearSocialCache, getSocialDashboard } from "@/lib/socialDashboard";
import { RANGE_PRESETS, todayInColombia } from "@/lib/socialRanges";
import { MIN_POSTS, generateContentDiagnosis as runContentDiagnosis, type ContentDiagnosis } from "@/lib/contentDiagnosis";
import { withAiUsage } from "@/lib/aiUsage";

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

export type ContentDiagnosisResult =
  | { status: "ok"; diagnosis: ContentDiagnosis; generatedAt: string; range: string }
  | { status: "insufficient_data"; posts: number }
  | { status: "error"; message: string };

// A fresh report is only worth it once new posts have had time to get numbers.
const DIAGNOSIS_COOLDOWN_MS = 10 * 60 * 1000;

export async function generateContentDiagnosis(businessId: string): Promise<ContentDiagnosisResult> {
  await requireBusinessMembership(await userId(), businessId);
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { contentDiagnosisAt: true } });
  if (!connection) return { status: "error", message: "Conecta tus redes primero." };
  if (connection.contentDiagnosisAt && Date.now() - connection.contentDiagnosisAt.getTime() < DIAGNOSIS_COOLDOWN_MS) {
    return { status: "error", message: "Acabas de generar un diagnóstico. Espera unos minutos antes de pedir otro." };
  }

  try {
    // The last 30 days, or 90 when the business posts rarely.
    const today = todayInColombia();
    const preset = (key: string) => RANGE_PRESETS.find((p) => p.key === key)!.range(today);
    let data = await getSocialDashboard(businessId, preset("30d"));
    if ((data.posts?.ok ? data.posts.data.length : 0) < MIN_POSTS) data = await getSocialDashboard(businessId, preset("3m"));
    if (data.needsReconnect) return { status: "error", message: "Tu conexión con Facebook venció. Reconéctala y vuelve a intentarlo." };

    const result = await withAiUsage(businessId, "DIAGNOSIS", () => runContentDiagnosis(businessId, data));
    if (result.status === "insufficient_data") return result;

    const generatedAt = new Date();
    await prisma.socialConnection.update({
      where: { businessId },
      data: { contentDiagnosis: { ...result.diagnosis, range: data.range }, contentDiagnosisAt: generatedAt },
    });
    revalidatePath(`/dashboard/businesses/${businessId}/redes`);
    return { status: "ok", diagnosis: result.diagnosis, generatedAt: generatedAt.toISOString(), range: `${data.range.since}|${data.range.until}` };
  } catch (err) {
    console.error("[social] content diagnosis failed", err);
    return { status: "error", message: "No se pudo generar el diagnóstico. Intenta de nuevo en un momento." };
  }
}

// ---- Mensajes (Messenger + Instagram Direct, answered by people) ----

const inboxPath = (businessId: string) => `/dashboard/businesses/${businessId}/redes/mensajes`;

export async function sendSocialReply(
  businessId: string,
  thread: { conversationId: string; network: "facebook" | "instagram"; recipientId: string },
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBusinessMembership(await userId(), businessId);
  const body = text.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Escribe un mensaje" };
  const connection = await prisma.socialConnection.findUnique({ where: { businessId }, select: { fbPageId: true, pageAccessToken: true } });
  if (!connection?.fbPageId || !connection.pageAccessToken) return { ok: false, error: "Conecta tu página de Facebook primero." };
  try {
    await sendReply({ pageId: connection.fbPageId, pageToken: decryptSecret(connection.pageAccessToken), recipientId: thread.recipientId, text: body });
  } catch (err) {
    console.error("[social] reply failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Meta no dejó enviar el mensaje." };
  }
  // Answering a thread reads it and puts it back in the open list.
  await prisma.socialThreadState.upsert({
    where: { businessId_conversationId: { businessId, conversationId: thread.conversationId } },
    create: { businessId, conversationId: thread.conversationId, network: thread.network, readAt: new Date() },
    update: { readAt: new Date() },
  });
  revalidatePath(inboxPath(businessId));
  return { ok: true };
}

export async function setSocialThreadResolved(
  businessId: string,
  thread: { conversationId: string; network: "facebook" | "instagram" },
  resolved: boolean,
): Promise<void> {
  await requireBusinessMembership(await userId(), businessId);
  await prisma.socialThreadState.upsert({
    where: { businessId_conversationId: { businessId, conversationId: thread.conversationId } },
    create: { businessId, conversationId: thread.conversationId, network: thread.network, resolvedAt: resolved ? new Date() : null, readAt: new Date() },
    update: { resolvedAt: resolved ? new Date() : null },
  });
  revalidatePath(inboxPath(businessId));
}
