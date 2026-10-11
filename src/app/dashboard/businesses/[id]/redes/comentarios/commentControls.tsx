"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actOnSocialComment, setSocialCommentDone } from "@/lib/socialActions";
import type { CommentNetwork } from "@/lib/metaComments";

type Mode = null | "reply" | "private";

export function CommentActions({
  businessId,
  comment,
  hidden,
  done,
  canPrivate,
  authorName,
}: {
  businessId: string;
  comment: { id: string; network: CommentNetwork };
  hidden: boolean;
  done: boolean;
  canPrivate: boolean;
  authorName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string } | void>, after?: () => void) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await fn();
      if (res && !res.ok) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function send() {
    const body = text.trim();
    if (!body || !mode || pending) return;
    const kind = mode;
    run(
      () => actOnSocialComment(businessId, comment, { kind, text: body }),
      () => {
        setText("");
        setMode(null);
        setNotice(kind === "private" ? "Mensaje privado enviado. La conversación sigue en Mensajes." : "Respuesta publicada.");
      },
    );
  }

  const chip =
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60";
  const idle = "border-border text-ink-muted hover:border-border-strong hover:text-ink";
  const on = "border-accent/50 bg-accent/10 text-ink";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={pending} onClick={() => setMode(mode === "reply" ? null : "reply")} className={`${chip} ${mode === "reply" ? on : idle}`}>
          💬 Responder
        </button>
        <button
          type="button"
          disabled={pending || !canPrivate}
          title={canPrivate ? "Le llega un mensaje privado por Messenger o Instagram Direct" : "Meta solo deja escribir por privado durante 7 días después del comentario"}
          onClick={() => setMode(mode === "private" ? null : "private")}
          className={`${chip} ${mode === "private" ? on : idle}`}
        >
          ✉️ Mensaje privado
        </button>
        <button
          type="button"
          disabled={pending}
          title={hidden ? "Volver a mostrarlo a todos" : "Solo lo verán quien lo escribió y sus amigos"}
          onClick={() => run(() => actOnSocialComment(businessId, comment, { kind: "hide", hidden: !hidden }))}
          className={`${chip} ${idle}`}
        >
          {hidden ? "👁 Mostrar" : "🙈 Ocultar"}
        </button>
        <button
          type="button"
          disabled={pending}
          title={done ? "Volver a la lista de pendientes" : "No necesita respuesta (un emoji, una etiqueta a un amigo)"}
          onClick={() => run(() => setSocialCommentDone(businessId, comment, !done))}
          className={`${chip} ${done ? idle : "border-accent/40 text-ink hover:bg-accent/10"}`}
        >
          {done ? "↺ Pendiente" : "✓ Listo"}
        </button>
      </div>

      {mode && (
        <div className="space-y-2 rounded-xl border border-border bg-background/60 p-2.5">
          <label htmlFor={`reply-${comment.id}`} className="block text-xs font-medium text-ink-muted">
            {mode === "reply" ? `Respuesta pública para ${authorName}` : `Mensaje privado para ${authorName} (Meta deja enviar uno por comentario)`}
          </label>
          <textarea
            id={`reply-${comment.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            maxLength={2000}
            autoFocus
            placeholder={mode === "reply" ? "¡Gracias por comentar! …" : "Hola, te escribo por tu comentario…"}
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setMode(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending || !text.trim()}
              onClick={send}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              {pending ? "Enviando…" : mode === "reply" ? "Publicar respuesta" : "Enviar privado"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
      {notice && <p className="text-xs text-[var(--status-good)]">{notice}</p>}
    </div>
  );
}
