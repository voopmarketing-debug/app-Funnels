"use client";

import { useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button red and puts the focus on Cancelar. */
  tone?: "danger" | "default";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((pending: Pending) => void) | null = null;

/**
 * The app's own "¿Estás seguro?" window, in place of the browser's
 * confirm() (which opens a gray system box from the address bar and reads as
 * an alert, not as part of the product). Answers true when the person
 * confirms. Needs <ConfirmHost /> mounted once (see providers.tsx); without
 * it, falls back to the browser's box so nothing is ever deleted unasked.
 */
export function askConfirm(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
  if (!show) return Promise.resolve(typeof window !== "undefined" ? window.confirm(opts.message) : false);
  const open = show;
  return new Promise<boolean>((resolve) => open({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const answered = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (next) => {
      // A second question while one is open: the first counts as "no".
      setPending((current) => {
        current?.resolve(false);
        return next;
      });
    };
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    answered.current = false;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // The safe choice has the focus: Cancelar when it is destructive, so a stray Enter does no harm.
    (pending.tone === "danger" ? cancelRef : confirmRef).current?.focus();
  }, [pending]);

  function answer(ok: boolean) {
    if (!pending || answered.current) return;
    answered.current = true;
    const current = pending;
    dialogRef.current?.close();
    setPending(null);
    current.resolve(ok);
  }

  if (!pending) return null;
  const danger = pending.tone === "danger";
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      // Escape, or any other way the browser closes it, counts as "no".
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) answer(false);
      }}
      className="fl-confirm w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3.5">
          <span
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg font-bold ${danger ? "bg-error/15 text-error" : "bg-accent/15 text-accent"}`}
            aria-hidden="true"
          >
            {danger ? "!" : "?"}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">
              {pending.title ?? (danger ? "¿Seguro que quieres hacerlo?" : "¿Continuar?")}
            </h2>
            <p id="confirm-message" className="mt-1 text-sm leading-relaxed text-ink-muted">
              {pending.message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => answer(false)}
            className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-2"
          >
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => answer(true)}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${danger ? "bg-error text-white hover:opacity-90" : "bg-accent text-accent-ink hover:bg-accent-hover"}`}
          >
            {pending.confirmLabel ?? (danger ? "Sí, continuar" : "Continuar")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
