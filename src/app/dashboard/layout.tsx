import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "./DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isAgencyAdmin = session?.user?.id
    ? (await prisma.membership.findFirst({ where: { userId: session.user.id, role: "ADMIN" }, select: { id: true } })) !== null
    : false;

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
    <div className="flex min-h-screen">
      <div className="fl-ambient-bg" />
      <DashboardSidebar
        isAgencyAdmin={isAgencyAdmin}
        primaryBusinessId={primaryBusiness?.businessId ?? null}
        onSignOut={handleSignOut}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border px-6 py-3">
          <Link href="/dashboard/account" className="fl-mono text-xs tracking-wide text-ink-muted transition hover:text-ink">
            {session?.user?.email}
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
