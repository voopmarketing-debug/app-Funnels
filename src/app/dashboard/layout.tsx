import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

// Support channel shown to every client in the dashboard header — the
// agency's own WhatsApp click-to-chat link.
const SUPPORT_LINK = { href: "https://wa.me/message/F2RWC3YUI7EYM1", label: "Soporte" };

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path
        d="M17 14.5c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5-.17 0-.37-.02-.57-.02-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.75-.71 2-1.4.25-.69.25-1.28.17-1.4-.07-.12-.27-.2-.57-.35Z"
        fill="currentColor"
      />
      <path
        d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.6-1.21A9 9 0 1 0 12 3Zm0 1.6a7.4 7.4 0 1 1-3.99 13.63l-.29-.18-2.73.72.73-2.65-.19-.3A7.4 7.4 0 0 1 12 4.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const support = SUPPORT_LINK;

  const isAgencyAdmin = session?.user?.id
    ? (await prisma.membership.findFirst({ where: { userId: session.user.id, role: "ADMIN" }, select: { id: true } })) !== null
    : false;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <FunnelsLogoMark className="h-6 w-6 flex-none" />
            <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
              Funnels_Labs
            </span>
          </Link>
          {isAgencyAdmin && (
            <Link href="/dashboard/clients" className="text-sm font-medium text-ink-muted transition hover:text-ink">
              Clientes
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href={support.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            <WhatsAppIcon />
            {support.label}
          </a>
          <Link href="/dashboard/account" className="text-ink-muted transition hover:text-ink hover:underline">
            {session?.user?.email}
          </Link>
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
