"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar at the top of the screen that appears the instant a link is
 * tapped and disappears when the next page is on screen — so a tap always
 * shows a response, even on a slow phone or connection.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the route changed: navigation done
    setActive(false);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (only a #section): nothing to wait for. Public sites and
      // API routes are full page loads, not in-app navigations.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (url.pathname.startsWith("/sitio") || url.pathname.startsWith("/api")) return;
      setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setActive(false), 15000);
    return () => clearTimeout(id);
  }, [active]);

  return (
    <div
      aria-hidden="true"
      data-nav-progress={active ? "on" : "off"}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
    >
      <div className={`h-full bg-accent shadow-[0_0_8px_var(--accent)] ${active ? "fl-nav-progress" : "w-0"}`} />
    </div>
  );
}
