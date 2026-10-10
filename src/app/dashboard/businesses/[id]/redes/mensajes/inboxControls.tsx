"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendSocialReply, setSocialThreadResolved } from "@/lib/socialActions";

type ThreadRef = { conversationId: string; network: "facebook" | "instagram"; recipientId: string };

/** Re-reads the inbox from Meta every 20 s while the tab is visible. */
export function InboxPoller() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
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
