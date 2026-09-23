"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.5 5.3c1.4.3 2.5 1.5 2.5 3s-1.1 2.7-2.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 14.2c1.9.5 3.3 2.2 3.3 4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M4 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20v-6M13 20v-9M18 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrmIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4.5v15M15 4.5v15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 19.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-none">
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

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 16l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardSidebar({
  isAgencyAdmin,
  primaryBusinessId,
  onSignOut,
}: {
  isAgencyAdmin: boolean;
  primaryBusinessId: string | null;
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  return (
    <aside className="flex min-h-screen w-52 flex-none flex-col gap-2 border-r border-border bg-surface py-5">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-4">
        <FunnelsLogoMark className="h-6 w-6 flex-none" />
        <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <Link
          href="/dashboard"
          className="fl-nav-item"
          data-active={isActive("/dashboard") && !isActive("/dashboard/clients") && !isActive("/dashboard/account")}
        >
          <HomeIcon />
          Agentes de IA
        </Link>
        {primaryBusinessId && (
          <Link
            href={`/dashboard/businesses/${primaryBusinessId}/analytics`}
            className="fl-nav-item"
            data-active={isActive(`/dashboard/businesses/${primaryBusinessId}/analytics`)}
          >
            <ChartIcon />
            KPIs
          </Link>
        )}
        {primaryBusinessId && (
          <Link
            href={`/dashboard/businesses/${primaryBusinessId}/crm`}
            className="fl-nav-item"
            data-active={isActive(`/dashboard/businesses/${primaryBusinessId}/crm`)}
          >
            <CrmIcon />
            CRM
          </Link>
        )}
        {primaryBusinessId && (
          <Link
            href={`/dashboard/businesses/${primaryBusinessId}/website`}
            className="fl-nav-item"
            data-active={isActive(`/dashboard/businesses/${primaryBusinessId}/website`)}
          >
            <WebsiteIcon />
            Sitio web
          </Link>
        )}
        {primaryBusinessId && (
          <Link
            href={`/dashboard/businesses/${primaryBusinessId}/templates`}
            className="fl-nav-item"
            data-active={isActive(`/dashboard/businesses/${primaryBusinessId}/templates`)}
          >
            <TemplateIcon />
            Plantillas
          </Link>
        )}
        {isAgencyAdmin && (
          <Link href="/dashboard/clients" className="fl-nav-item" data-active={isActive("/dashboard/clients")}>
            <UsersIcon />
            Clientes
          </Link>
        )}
        <Link href="/dashboard/account" className="fl-nav-item" data-active={isActive("/dashboard/account")}>
          <UserIcon />
          Mi perfil
        </Link>
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 pt-3">
        <ThemeToggle className="fl-nav-item" showLabel />
        <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="fl-nav-item">
          <WhatsAppIcon />
          Soporte
        </a>
        <form action={onSignOut}>
          <button type="submit" className="fl-nav-item">
            <LogoutIcon />
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}
