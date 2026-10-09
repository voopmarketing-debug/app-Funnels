import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { defaultAdAccount, defaultPage, exchangeCodeForToken, listAdAccounts, listPages, verifyState } from "@/lib/metaSocial";
import { clearSocialCache } from "@/lib/socialDashboard";

// Meta sends the owner back here after "Conectar con Facebook". Saves a
// long-lived user token and picks the Page and ad account to measure (the
// owner can switch them with "Cambiar cuentas"), so they land straight on
// their numbers instead of a form.
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
    const page = defaultPage(pages);
    const ad = defaultAdAccount(adAccounts);
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
    return back(page || ad ? "connected=1" : "choose=1");
  } catch (err) {
    console.error("[social] Meta connect failed", err);
    return back("error=meta");
  }
}
