"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { sendSocialReply, updateSocialThread } from "@/lib/socialActions";
import type { ThreadAction, ThreadFlags } from "@/lib/threadState";

const POLL_MS = 30_000;
const IDLE_STOP_MS = 30 * 60_000;

type ThreadRef = { conversationId: string; network: "facebook" | "instagram"; recipientId: string };

/**
 * Re-reads the inbox from Meta every 30 s while the tab is visible, and
 * stops after 30 minutes without the person touching the page (a forgotten
 * open tab shouldn't keep spending Meta's rate limit for the whole Page).
 */
export function InboxPoller() {
  const router = useRouter();
  useEffect(() => {
    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActivity < IDLE_STOP_MS) router.refresh();
    }, POLL_MS);
    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [router]);
  return null;
}

/**
 * Inside a conversation link: a small spinner while that conversation loads,
 * so the click answers at once instead of looking dead for a few seconds.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`ml-1 h-3.5 w-3.5 flex-none rounded-full border-2 border-accent border-t-transparent transition-opacity ${pending ? "animate-spin opacity-100" : "opacity-0"}`}
    />
  );
}

/** Keeps the newest message in view when the thread opens or grows. */
export function ScrollToBottom({ dep }: { dep: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [dep]);
  return <span ref={ref} />;
}

export function ResolveButton({ businessId, thread, resolved }: { businessId: string; thread: ThreadRef; resolved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => updateSocialThread(businessId, thread, resolved ? "reopen" : "close"))}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
        resolved ? "border-border text-ink-muted hover:text-ink" : "border-accent/50 bg-accent/10 text-ink hover:bg-accent/20"
      }`}
    >
      {resolved ? "Reabrir" : "✓ Cerrar conversación"}
    </button>
  );
}

type MenuItem = { action: ThreadAction; label: string; hint: string };

/**
 * The "⋯" menu of a conversation (in the list and in the open conversation):
 * mark it read or unread, answered outside the platform, or closed. It opens
 * over everything (fixed position) so the scrolling list can't cut it off.
 */
export function ThreadMenu({ businessId, thread, flags }: { businessId: string; thread: ThreadRef; flags: Pick<ThreadFlags, "unread" | "answered" | "closed"> }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [pending, start] = useTransition();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    // The menu is positioned from the button when it opens: scrolling the list or resizing closes it.
    // (Not the first instant: focusing the first item can fire a scroll event of its own.)
    let armed = false;
    const arm = setTimeout(() => (armed = true), 150);
    const away = () => armed && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => {
      clearTimeout(arm);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const items: MenuItem[] = [
    flags.unread
      ? { action: "read", label: "Marcar como leída", hint: "Quita el punto de sin leer" }
      : { action: "unread", label: "Marcar como no leída", hint: "Para volver a ella después" },
    flags.answered
      ? { action: "unanswered", label: "Quitar “respondida”", hint: "Vuelve a esperar tu respuesta" }
      : { action: "answered", label: "Marcar como respondida", hint: "Ya la atendiste por otro medio" },
    flags.closed
      ? { action: "reopen", label: "Reabrir conversación", hint: "Vuelve a la lista de abiertas" }
      : { action: "close", label: "Cerrar conversación", hint: "Ya está resuelta" },
  ];

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!open && button.current) {
      const r = button.current.getBoundingClientRect();
      // Below the button, or above it when the list's bottom is close.
      const room = window.innerHeight - r.bottom;
      setPos({ top: room < 200 ? Math.max(8, r.top - 176) : r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más opciones de esta conversación"
        title="Más opciones"
        disabled={pending}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 disabled:opacity-50"
      >
        ⋯
      </button>
      {open && (
        <ul
          ref={menu}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-64 rounded-xl border border-border-strong bg-surface p-1 shadow-2xl"
        >
          {items.map((it) => (
            <li key={it.action} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  start(() => updateSocialThread(businessId, thread, it.action));
                }}
                className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <span className="block text-sm font-semibold text-ink">{it.label}</span>
                <span className="block text-[11px] text-ink-muted">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ReplyBox({ businessId, thread, windowOpen }: { businessId: string; thread: ThreadRef; windowOpen: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const res = await sendSocialReply(businessId, thread, body);
      if (res.ok) {
        setText("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!windowOpen) {
    return (
      <p className="rounded-xl border border-border bg-surface-2/60 p-3 text-sm text-ink-muted">
        Pasaron más de 24 horas desde el último mensaje de esta persona. Meta no deja responder hasta que vuelva a escribir.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-accent">
        <label htmlFor="social-reply" className="sr-only">
          Escribe tu respuesta
        </label>
        <textarea
          id="social-reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Escribe tu respuesta… (Enter envía, Shift+Enter salta de línea)"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none [field-sizing:content]"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !text.trim()}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
