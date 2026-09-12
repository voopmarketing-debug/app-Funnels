import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Only guards page navigation (GET). POST requests to dashboard routes are
// Server Action invocations, which NextAuth's request wrapper here does not
// forward cleanly to Next's action runtime — those routes already enforce
// auth themselves (see src/lib/actions.ts and each page's own auth() check).
export default auth((req) => {
  if (req.method !== "GET") return;

  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
