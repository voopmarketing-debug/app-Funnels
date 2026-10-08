import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin as isAgencyAccount } from "@/lib/authz";
import { DashboardSidebar } from "./DashboardSidebar";
import { NotificationBell, type NotificationItem } from "./NotificationBell";
import { PushBanner } from "./PushNotifications";
import { NotificationSoundPoller } from "./NotificationSoundPoller";

function formatNotificationDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isAgencyAdmin = session?.user?.id ? await isAgencyAccount(session.user.id) : false;

  // Self-registered accounts can't use the dashboard until they register a
  // card in Mercado Pago (free trial) — see app/activar.
  if (session?.user?.id && !isAgencyAdmin) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { activationRequired: true } });
    if (me?.activationRequired) redirect("/activar");
  }

  // Every business this user has any access to (owner, agency, or invited
  // teammate) — a MEMBER sees appointment notifications for their own leads
  // just like the owner does, same as the rest of their CRM access.
  let notifications: NotificationItem[] = [];
  let unreadCount = 0;
  if (session?.user?.id) {
    const businessIds = (
      await prisma.membership.findMany({ where: { userId: session.user.id }, select: { businessId: true } })
    ).map((m) => m.businessId);

    if (businessIds.length > 0) {
      const [rows, count] = await Promise.all([
        prisma.notification.findMany({
          where: { businessId: { in: businessIds } },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { business: { select: { name: true } } },
        }),
        prisma.notification.count({ where: { businessId: { in: businessIds }, readAt: null } }),
      ]);
      notifications = rows.map((n) => ({
        id: n.id,
        message: n.message,
        createdAt: formatNotificationDate(n.createdAt),
        read: n.readAt !== null,
        // Appointment notifications point straight at the conversation;
        // metric alerts (see lib/metricAlerts.ts) have no single
        // conversation to point to, so they go to the KPIs page instead.
        href: n.conversationId
          ? `/dashboard/businesses/${n.businessId}/conversations/${n.conversationId}`
          : `/dashboard/businesses/${n.businessId}/analytics`,
        businessName: n.business.name,
      }));
      unreadCount = count;
    }
  }

  // KPIs and CRM are per-business pages, but the sidebar is global — link
  // those two nav items straight to a first business (any the user has
  // access to — their own if they're a client, or the first one they
  // administer if they're the agency) instead of making them dig through
  // "Agentes de IA" first. Hidden entirely if they have no business yet.
  // Once there, AgentSwitcher lets them pick a different one — the agency
  // isn't stuck looking at just this one.
  const primaryBusiness = session?.user?.id
    ? await prisma.membership.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { businessId: true },
      })
    : null;

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
        onSignOut={handleSignOut}
        mobileActions={<NotificationBell notifications={notifications} unreadCount={unreadCount} />}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Desktop only — on mobile the bell lives in the sidebar's top bar
            and "Mi perfil" is in the menu, so this row would just duplicate them. */}
        <header className="hidden items-center justify-end gap-3 border-b border-border px-6 py-3 md:flex">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <Link href="/dashboard/account" className="fl-mono text-xs tracking-wide text-ink-muted transition hover:text-ink">
            Mi perfil
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <PushBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
