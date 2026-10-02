"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// After this long with the next page still not on screen, load it the
// classic way (a full page load) — exactly what refreshing did by hand
// when a navigation got stuck (e.g. a server that was asleep and took too
// long to answer the in-app request).
const STUCK_AFTER_MS = 6000;

function stillLoading(): boolean {
  return !!document.querySelector("[data-loading-skeleton]");
}

/**
 * A thin bar at the top of the screen that appears the instant a link is
 * tapped and stays until the next page is really on screen — and a
 * watchdog that never lets a navigation hang.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const pending = useRef<{ from: string; to: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  // The route changed: hide the bar once the page (not its skeleton) shows.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const settle = () => {
      if (stillLoading()) return false;
      setActive(false);
      return true;
    };
    if (!settle()) id = setInterval(() => settle() && clearInterval(id), 150);
    return () => clearInterval(id);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (only a #section): nothing to wait for. Public sites and
      // API routes are full page loads, not in-app navigations.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (url.pathname.startsWith("/sitio") || url.pathname.startsWith("/api")) return;

      setActive(true);
      if (pending.current) clearTimeout(pending.current.timer);
      const from = window.location.pathname + window.location.search;
      const to = url.pathname + url.search;
      pending.current = {
        from,
        to,
        timer: setTimeout(() => {
          const here = window.location.pathname + window.location.search;
          // Never left the page, or arrived but only the skeleton is showing.
          if (here === from || stillLoading()) window.location.assign(to);
          pending.current = null;
        }, STUCK_AFTER_MS),
      };
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (pending.current) clearTimeout(pending.current.timer);
    };
  }, []);

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
