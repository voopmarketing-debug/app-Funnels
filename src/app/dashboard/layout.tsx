import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "./DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isAgencyAdmin = session?.user?.id
    ? (await prisma.membership.findFirst({ where: { userId: session.user.id, role: "ADMIN" }, select: { id: true } })) !== null
    : false;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full">
      <div className="fl-ambient-bg" />
      <DashboardSidebar isAgencyAdmin={isAgencyAdmin} onSignOut={handleSignOut} />
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
