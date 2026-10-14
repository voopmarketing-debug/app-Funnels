"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { sendSocialReply, setSocialThreadResolved } from "@/lib/socialActions";

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
      onClick={() => start(() => setSocialThreadResolved(businessId, thread, !resolved))}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
        resolved ? "border-border text-ink-muted hover:text-ink" : "border-accent/50 bg-accent/10 text-ink hover:bg-accent/20"
      }`}
    >
      {resolved ? "Reabrir" : "✓ Marcar como resuelta"}
    </button>
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
