import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin as isAgencyAccount } from "@/lib/authz";
import { DashboardSidebar } from "./DashboardSidebar";
import { BellPlaceholder, NotificationBellLoader, RenewalLoader, countUnreadChats } from "./LayoutLoaders";
import { PushBanner } from "./PushNotifications";
import { NotificationSoundPoller } from "./NotificationSoundPoller";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { isStoreApp } from "@/lib/storeApp";

// The Asistente Funnels runs a few Claude calls per message from these pages.
export const maxDuration = 120;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Signed out, expired, or ended by a password change on another device:
  // straight to the login instead of an empty panel.
  if (!session?.user?.id) redirect("/login");

  // Everything the frame needs before it can draw, asked at the same time (one round trip, not five).
  const userId = session.user.id;
  const [storeApp, isAgencyAdmin, me, primaryBusiness] = await Promise.all([
    isStoreApp(),
    isAgencyAccount(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { activationRequired: true } }),
    // KPIs, CRM and Conversaciones are per-business pages, but the sidebar is global: those nav items
    // link straight to a first business the user has access to (their own, or the first one the
    // agency administers). Hidden entirely if they have no business yet.
    prisma.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { businessId: true } }),
  ]);

  // Self-registered accounts can't use the dashboard until they register a
  // card in Mercado Pago (free trial) — see app/activar.
  if (!isAgencyAdmin && me?.activationRequired) redirect("/activar");

  // The red badge on "Conversaciones" is the slowest question of the frame: it is asked now, but
  // the page does not wait for it (the badge appears when the answer arrives).
  const unreadChats = primaryBusiness ? countUnreadChats(primaryBusiness.businessId) : Promise.resolve(0);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    // flex-col on mobile stacks the sidebar's top bar above the page content
    // (see DashboardSidebar) instead of squeezing them side by side; md:
    // flex-row restores today's row layout unchanged on desktop.
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="fl-ambient-bg" />
      <NotificationSoundPoller />
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <DashboardSidebar
        isAgencyAdmin={isAgencyAdmin}
        primaryBusinessId={primaryBusiness?.businessId ?? null}
        unreadChats={unreadChats}
        onSignOut={handleSignOut}
        mobileActions={
          <Suspense fallback={<BellPlaceholder />}>
            <NotificationBellLoader userId={userId} />
          </Suspense>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
        {/* Desktop only — on mobile the bell lives in the sidebar's top bar
            and "Mi perfil" is in the menu, so this row would just duplicate them. */}
        <header className="hidden items-center justify-end gap-3 border-b border-border px-6 py-3 md:flex">
          <Suspense fallback={<BellPlaceholder />}>
            <NotificationBellLoader userId={userId} />
          </Suspense>
          <Link href="/dashboard/account" className="fl-mono text-xs tracking-wide text-ink-muted transition hover:text-ink">
            Mi perfil
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {!isAgencyAdmin && !storeApp && (
            <Suspense fallback={null}>
              <RenewalLoader userId={userId} />
            </Suspense>
          )}
          <PushBanner />
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <AssistantChat />
      </Suspense>
    </div>
  );
}
