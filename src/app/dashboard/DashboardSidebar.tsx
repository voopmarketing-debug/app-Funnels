"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { FunnelsLogoBadge } from "@/components/FunnelsLogoMark";
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

function BotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <rect x="4.5" y="7.5" width="15" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V4.5M9.5 12.5v1M14.5 12.5v1M2.5 12v2.5M21.5 12v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="3.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M20.5 4 10 14.5M20.5 4l-6.5 16-3.5-5.5L5 11l15.5-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <rect x="3.5" y="4" width="6.5" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="15" width="6.5" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M6.75 9v3.5a2 2 0 0 0 2 2H14M14 14.5l-2-2M14 14.5l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function CoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.8 1.4 5.8 4.3 0 1.3-1.2 2.1-3 2.1-1.4 0-2.5-.6-3-1.6M12 6v1.8M12 16.3V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function SocialIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M5 19v-7M11 19V6M17 19v-5M3 19h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="flex-none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`flex-none transition-transform ${open ? "" : "-rotate-90"}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Which groups the person folded, remembered in this browser. Kept in a tiny
// external store so the server render (everything open) and the first client
// render agree, and the saved choice applies right after hydration.
const COLLAPSED_KEY = "fl-nav-collapsed";
const collapsedListeners = new Set<() => void>();
let collapsedMemory = "";

function readCollapsed(): string {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) ?? collapsedMemory;
  } catch {
    return collapsedMemory;
  }
}

function subscribeCollapsed(cb: () => void) {
  collapsedListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    collapsedListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function writeCollapsed(ids: string[]) {
  collapsedMemory = ids.join(",");
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsedMemory);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page reloads.
  }
  collapsedListeners.forEach((cb) => cb());
}

type NavItem = { href: string; label: string; icon: React.ReactNode; active: boolean; badge?: number };
type NavGroup = { id: string; title: string; items: NavItem[] };

function NavGroupSection({ group, collapsed, onToggle }: { group: NavGroup; collapsed: boolean; onToggle: () => void }) {
  // The group you are in stays open, so the highlighted page is never hidden.
  const hasActive = group.items.some((item) => item.active);
  const open = hasActive || !collapsed;
  const listId = `fl-nav-group-${group.id}`;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={hasActive ? undefined : onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={`flex w-full items-center justify-between rounded-md px-3 text-left pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted/80 transition hover:text-ink ${
          hasActive ? "cursor-default" : ""
        }`}
      >
        {group.title}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div id={listId} className="flex flex-col gap-1">
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className="fl-nav-item" data-active={item.active}>
              {item.icon}
              {item.label}
              {item.badge ? (
                <span
                  className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--status-bad,#d03b3b)] px-1.5 text-[11px] font-bold leading-none text-white"
                  aria-label={`${item.badge} sin leer`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// The link list, shared by the always-visible desktop <aside> and the
// slide-in mobile drawer below — kept in one place so the two never drift
// out of sync with each other.
function NavLinks({
  isAgencyAdmin,
  primaryBusinessId,
  pathname,
  unreadChats,
  onSignOut,
}: {
  isAgencyAdmin: boolean;
  primaryBusinessId: string | null;
  pathname: string;
  unreadChats: number;
  onSignOut: () => Promise<void>;
}) {
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const collapsedRaw = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => "");
  const collapsedIds = collapsedRaw ? collapsedRaw.split(",") : [];

  function toggleGroup(id: string) {
    writeCollapsed(collapsedIds.includes(id) ? collapsedIds.filter((x) => x !== id) : [...collapsedIds, id]);
  }

  const biz = primaryBusinessId ? `/dashboard/businesses/${primaryBusinessId}` : null;
  const item = (href: string, label: string, icon: React.ReactNode, active = isActive(href), badge?: number): NavItem => ({ href, label, icon, active, badge });

  // Empty groups (a login without a business, or a non-agency login) drop out.
  const groups: NavGroup[] = [
    {
      id: "comunicaciones",
      title: "Comunicaciones",
      items: [
        biz && item(`${biz}/conversaciones`, "Conversaciones", <ChatBubbleIcon />, undefined, unreadChats),
        biz && item(`${biz}/difusiones`, "Difusiones", <SendIcon />),
        biz && item(`${biz}/templates`, "Plantillas", <TemplateIcon />),
      ].filter((x): x is NavItem => !!x),
    },
    {
      id: "ventas",
      title: "Ventas",
      items: [biz && item(`${biz}/crm`, "CRM", <CrmIcon />), isAgencyAdmin && item("/dashboard/clients", "Clientes", <UsersIcon />)].filter(
        (x): x is NavItem => !!x,
      ),
    },
    {
      id: "ia",
      title: "IA y flujos",
      items: [
        // The agent's setup page (connections, instructions, catalog, team) for
        // the current business; the list of every agent is one click away from there.
        item(
          biz ?? "/dashboard/agentes",
          "Agente de IA",
          <BotIcon />,
          pathname.startsWith("/dashboard/agentes") ||
            pathname === "/dashboard/businesses/new" ||
            (!!biz && (pathname === biz || pathname.startsWith(`${biz}/productos`) || pathname.startsWith(`${biz}/inventario`))),
        ),
        biz && item(`${biz}/automatizaciones`, "Automatizaciones", <FlowIcon />),
      ].filter((x): x is NavItem => !!x),
    },
    {
      id: "marketing",
      title: "Marketing",
      items: [biz && item(`${biz}/redes`, "Redes sociales", <SocialIcon />), biz && item(`${biz}/website`, "Sitio web", <WebsiteIcon />)].filter(
        (x): x is NavItem => !!x,
      ),
    },
    {
      id: "analisis",
      title: "Análisis",
      items: [biz && item(`${biz}/analytics`, "KPIs", <ChartIcon />), isAgencyAdmin && item("/dashboard/rentabilidad", "Rentabilidad", <CoinIcon />)].filter(
        (x): x is NavItem => !!x,
      ),
    },
    {
      id: "integraciones",
      title: "Integraciones",
      items: [isAgencyAdmin && item("/dashboard/meta", "Conexión Meta", <WhatsAppIcon />)].filter((x): x is NavItem => !!x),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
        <Link href="/dashboard" className="fl-nav-item" data-active={isActive("/dashboard")}>
          <HomeIcon />
          Inicio
        </Link>
        {groups.map((group) => (
          <NavGroupSection key={group.id} group={group} collapsed={collapsedIds.includes(group.id)} onToggle={() => toggleGroup(group.id)} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 pt-3">
        {isAgencyAdmin && (
          <Link href="/dashboard/novedades" className="fl-nav-item" data-active={isActive("/dashboard/novedades")}>
            <MegaphoneIcon />
            Novedades
          </Link>
        )}
        <Link href="/dashboard/account" className="fl-nav-item" data-active={isActive("/dashboard/account")}>
          <UserIcon />
          Mi perfil
        </Link>
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
    </>
  );
}

export function DashboardSidebar({
  isAgencyAdmin,
  primaryBusinessId,
  unreadChats,
  onSignOut,
  mobileActions,
}: {
  isAgencyAdmin: boolean;
  primaryBusinessId: string | null;
  // Chats with customer messages nobody on the team has opened yet.
  unreadChats: number;
  onSignOut: () => Promise<void>;
  // Rendered in the mobile top bar next to the menu button (e.g. the
  // notification bell), so mobile doesn't need a second header row.
  mobileActions?: React.ReactNode;
}) {
  const realPathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // The item just tapped, highlighted right away (before the next page has
  // loaded) so the tap visibly registers.
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const pathname = pendingPath ?? realPathname;

  // Route changed: close the drawer and drop the optimistic highlight
  // (adjusted during render, React's pattern for state derived from props).
  const [lastPathname, setLastPathname] = useState(realPathname);
  if (lastPathname !== realPathname) {
    setLastPathname(realPathname);
    setMobileOpen(false);
    setPendingPath(null);
  }

  // Any link tapped in the menu: close the drawer at once (not when the next
  // page finishes loading) and highlight the destination. Runs in the
  // bubble phase, after <Link> has started its client-side navigation —
  // unmounting the drawer before that would turn it into a full reload.
  function handleNavTap(e: React.MouseEvent) {
    const link = (e.target as Element).closest("a");
    if (!link || link.target === "_blank") return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    setMobileOpen(false);
    if (url.pathname !== realPathname) setPendingPath(url.pathname);
  }

  return (
    <>
      {/* Mobile-only top bar — hidden entirely on md+ (md:hidden), so it
          never appears alongside or instead of the desktop sidebar below. */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <FunnelsLogoBadge size="sm" />
          <span className="text-base font-bold tracking-tight text-ink">Funnels Labs</span>
        </Link>
        <div className="flex items-center gap-2">
          {mobileActions}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-ink-muted transition hover:border-accent hover:text-accent"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* Mobile slide-in drawer — position:fixed takes it out of the page's
          normal flow entirely, so it never affects layout on any screen
          size, desktop included, whether open or not. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside onClick={handleNavTap} className="relative flex h-full w-64 flex-col gap-2 bg-surface py-5 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-4">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <FunnelsLogoBadge size="sm" />
                <span className="text-base font-bold tracking-tight text-ink">Funnels Labs</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="text-ink-muted transition hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <NavLinks isAgencyAdmin={isAgencyAdmin} primaryBusinessId={primaryBusinessId} pathname={pathname} unreadChats={unreadChats} onSignOut={onSignOut} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — identical to before, just now explicitly hidden
          below md so it doesn't fight the mobile top bar above for space. */}
      <aside onClick={handleNavTap} className="hidden h-screen w-52 flex-none flex-col gap-2 self-start border-r border-border bg-surface py-5 md:sticky md:top-0 md:flex">
        <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-4">
          <FunnelsLogoBadge />
          <span className="text-[17px] font-extrabold tracking-tight text-ink">Funnels Labs</span>
        </Link>
        <NavLinks isAgencyAdmin={isAgencyAdmin} primaryBusinessId={primaryBusinessId} pathname={pathname} unreadChats={unreadChats} onSignOut={onSignOut} />
      </aside>
    </>
  );
}
