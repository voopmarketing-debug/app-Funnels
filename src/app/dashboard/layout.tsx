import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "./DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isAgencyAdmin = session?.user?.id
    ? (await prisma.membership.findFirst({ where: { userId: session.user.id, role: "ADMIN" }, select: { id: true } })) !== null
    : false;

  // KPIs and CRM are per-business pages, but the sidebar is global — for a
  // client (who almost always has just one agent/negocio), link those two
  // nav items straight to their first business instead of making them dig
  // through "Agentes de IA" first. Hidden entirely if they don't own one.
  const primaryOwnedBusiness = session?.user?.id
    ? await prisma.membership.findFirst({
        where: { userId: session.user.id, role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { businessId: true },
      })
    : null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full">
      <div className="fl-ambient-bg" />
      <DashboardSidebar
        isAgencyAdmin={isAgencyAdmin}
        primaryBusinessId={primaryOwnedBusiness?.businessId ?? null}
        onSignOut={handleSignOut}
      />
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border px-6 py-3">
          <Link href="/dashboard/account" className="fl-mono text-xs tracking-wide text-ink-muted transition hover:text-ink">
            {session?.user?.email}
          </Link>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
