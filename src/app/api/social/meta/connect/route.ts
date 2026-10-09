import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { metaLoginUrl, signState } from "@/lib/metaSocial";

// Starts "Conectar con Facebook" for the Redes sociales module: sends the
// owner to Meta's login dialog, carrying the business in a signed state.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", url));
  try {
    await requireBusinessOwnerOrAdmin(session.user.id, businessId);
  } catch {
    return NextResponse.redirect(new URL("/dashboard", url));
  }
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.redirect(new URL(`/dashboard/businesses/${businessId}/redes?error=config`, url));
  }
  return NextResponse.redirect(metaLoginUrl(signState({ businessId, userId: session.user.id })));
}
