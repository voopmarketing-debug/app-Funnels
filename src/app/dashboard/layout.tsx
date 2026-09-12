import Link from "next/link";
import { auth, signOut } from "@/auth";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <FunnelsLogoMark className="h-6 w-6 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-muted">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-ink-muted underline hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
