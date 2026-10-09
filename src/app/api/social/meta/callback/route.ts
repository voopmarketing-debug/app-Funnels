import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { exchangeCodeForToken, listAdAccounts, listPages, verifyState } from "@/lib/metaSocial";
import { clearSocialCache } from "@/lib/socialDashboard";

// Meta sends the owner back here after "Conectar con Facebook". Saves a
// long-lived user token and, when there's only one Page / ad account to
// choose from, picks it right away; otherwise the Redes page asks.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = verifyState(url.searchParams.get("state") ?? "");
  if (!state) return NextResponse.redirect(new URL("/dashboard", url));
  const back = (query: string) => NextResponse.redirect(new URL(`/dashboard/businesses/${state.businessId}/redes?${query}`, url));

  const session = await auth();
  if (session?.user?.id !== state.userId) return NextResponse.redirect(new URL("/login", url));
  try {
    await requireBusinessOwnerOrAdmin(state.userId, state.businessId);
  } catch {
    return NextResponse.redirect(new URL("/dashboard", url));
  }

  const code = url.searchParams.get("code");
  if (!code) return back("error=cancelled");

  try {
    const { token, expiresAt } = await exchangeCodeForToken(code);
    const [pages, adAccounts] = await Promise.all([listPages(token), listAdAccounts(token).catch(() => [])]);
    const page = pages.length === 1 ? pages[0] : null;
    const activeAds = adAccounts.filter((a) => a.active);
    const ad = adAccounts.length === 1 ? adAccounts[0] : activeAds.length === 1 ? activeAds[0] : null;
    const selection = {
      fbPageId: page?.id ?? null,
      fbPageName: page?.name ?? null,
      pageAccessToken: page ? encryptSecret(page.accessToken) : null,
      igUserId: page?.igUserId ?? null,
      igUsername: page?.igUsername ?? null,
      adAccountId: ad?.id ?? null,
      adAccountName: ad?.name ?? null,
      adCurrency: ad?.currency ?? null,
    };
    await prisma.socialConnection.upsert({
      where: { businessId: state.businessId },
      create: { businessId: state.businessId, userAccessToken: encryptSecret(token), userTokenExpiresAt: expiresAt, connectedByUserId: state.userId, ...selection },
      update: { userAccessToken: encryptSecret(token), userTokenExpiresAt: expiresAt, connectedByUserId: state.userId, ...selection },
    });
    await clearSocialCache(state.businessId, true);
    const needsChoice = (pages.length > 1 && !page) || (adAccounts.length > 1 && !ad);
    return back(needsChoice ? "choose=1" : "connected=1");
  } catch (err) {
    console.error("[social] Meta connect failed", err);
    return back("error=meta");
  }
}
