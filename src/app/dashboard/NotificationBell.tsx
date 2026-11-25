"use client";

import { PushToggleRow } from "./PushNotifications";
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
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface hover:text-ink"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="fl-mono absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[12px] font-bold text-accent-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-14 z-50 rounded-md border border-border bg-surface shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-10 md:z-20 md:w-80">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Notificaciones</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-accent hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2 md:max-h-96">
            {notifications.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-faint">Sin notificaciones todavía.</p>
            )}
            {notifications.map((n) => {
              const v = describe(n.message);
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => handleOpenNotification(n.id)}
                  className={`block rounded-2xl border p-3 transition active:scale-[0.99] ${n.read ? "border-border bg-background/60 opacity-75" : v.card}`}
                >
                  <span className="flex items-start gap-3">
                    <span aria-hidden="true" className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl ${v.badge}`}>
                      {v.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-bold text-ink">{v.title}</span>
                        {!n.read && <span aria-label="Sin leer" className="h-2.5 w-2.5 flex-none rounded-full bg-accent" />}
                      </span>
                      {v.quote ? (
                        <span className="mt-1.5 block rounded-2xl rounded-tl-sm border border-border bg-surface px-3 py-2 text-sm text-ink">{v.body}</span>
                      ) : (
                        <span className="mt-1 block text-sm text-ink-muted">{v.body}</span>
                      )}
                      <span className="fl-mono mt-1.5 block text-[12px] text-ink-faint">
                        {n.businessName} · {n.createdAt}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <PushToggleRow />
        </div>
      )}
    </div>
  );
}

const LEADING_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;

/** Turns a stored notification text into a title, a body and a look, so each kind is easy to tell apart. */
function describe(message: string): { icon: string; title: string; body: string; quote: boolean; card: string; badge: string } {
  const lead = message.match(LEADING_EMOJI);
  const text = lead ? message.slice(lead[0].length) : message;
  const chat = text.match(/^(.*?)\s+te escribió:\s*"?([\s\S]*?)"?$/);
  if (chat) {
    return { icon: "💬", title: chat[1].trim() || "Cliente", body: chat[2].trim(), quote: true, card: "border-accent/50 bg-accent/10", badge: "bg-accent/25" };
  }
  const urgent = lead && ["⏰", "⚠", "❗", "🚨"].some((e) => lead[1].startsWith(e));
  return urgent
    ? { icon: lead![1], title: "Aviso importante", body: text, quote: false, card: "border-amber-400/50 bg-amber-400/10", badge: "bg-amber-400/25" }
    : { icon: lead?.[1] ?? "🔔", title: "Aviso", body: text, quote: false, card: "border-border-strong bg-surface-2/60", badge: "bg-surface-2" };
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
