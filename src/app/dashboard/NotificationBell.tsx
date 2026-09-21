"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";

export type NotificationItem = {
  id: string;
  message: string;
  createdAt: string; // pre-formatted, see layout.tsx
  read: boolean;
  href: string;
  businessName: string;
};

export function NotificationBell({ notifications, unreadCount }: { notifications: NotificationItem[]; unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleOpenNotification(id: string) {
    setOpen(false);
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface hover:text-ink"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="fl-mono absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-80 rounded-md border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Notificaciones</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-accent hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-faint">Sin notificaciones todavía.</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => handleOpenNotification(n.id)}
                className={`block border-b border-border px-3 py-2.5 text-sm transition hover:bg-background ${n.read ? "text-ink-muted" : "text-ink"}`}
              >
                <span className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />}
                  <span className="min-w-0 flex-1">
                    <span className="block">{n.message}</span>
                    <span className="fl-mono mt-0.5 block text-[10px] text-ink-faint">
                      {n.businessName} · {n.createdAt}
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 1.6 5.8.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1C5 15 6 13.2 6 10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
