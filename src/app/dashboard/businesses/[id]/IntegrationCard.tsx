"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

export type IntegrationStatus = { tone: "done" | "warn" | "todo"; label: string };

/**
 * One tile of the agent's "Conexiones" grid, Kommo-integrations style: a
 * coloured logo, what it is, and either "✓ Conectado" or a "+ Conectar"
 * button. A card with `children` opens them in a modal (the setup form);
 * a card with `href` goes to that section instead.
 *
 * `id` doubles as a deep link: /dashboard/businesses/[id]#whatsapp opens
 * the WhatsApp form straight away (used by Inicio's "Primeros pasos" and
 * the setup steps at the top of this page).
 */
export function IntegrationCard({
  id,
  title,
  description,
  logo,
  logoBackground,
  status,
  actionLabel,
  required = false,
  href,
  dialogTitle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  logo: React.ReactNode;
  logoBackground: string;
  status: IntegrationStatus;
  actionLabel: string;
  required?: boolean;
  href?: string;
  dialogTitle?: string;
  children?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, []);

  useEffect(() => {
    if (!children) return;
    function openFromHash() {
      if (window.location.hash === `#${id}`) open();
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [children, id, open]);

  function handleClose() {
    // Clear the deep link so the same step/link can open it again later.
    if (window.location.hash === `#${id}`) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  const done = status.tone === "done";
  const actionClass = done
    ? "rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-surface-2 hover:text-ink"
    : "rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent";

  const action = href ? (
    <Link href={href} className={actionClass}>
      {done ? actionLabel : `+ ${actionLabel}`}
    </Link>
  ) : (
    <button type="button" onClick={open} className={actionClass}>
      {done ? actionLabel : `+ ${actionLabel}`}
    </button>
  );

  return (
    <article
      id={id}
      className="fl-card flex scroll-mt-24 items-center gap-3 p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0"
    >
      <div
        className="flex h-14 w-14 flex-none items-center justify-center rounded-xl text-white sm:h-24 sm:w-full sm:rounded-none"
        style={{ background: logoBackground }}
      >
        {logo}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:p-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {required && !done && (
            <span className="flex-none rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
              Obligatorio
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-ink-muted">{description}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 sm:mt-3">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${
              status.tone === "done" ? "text-accent" : status.tone === "warn" ? "text-error" : "text-ink-faint"
            }`}
          >
            {status.tone === "done" ? "✓" : status.tone === "warn" ? "⚠" : "○"} {status.label}
          </span>
          {action}
        </div>
      </div>

      {children && (
        <dialog
          ref={dialogRef}
          onClose={handleClose}
          aria-label={dialogTitle ?? title}
          className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white [&_svg]:h-5 [&_svg]:w-5"
              style={{ background: logoBackground }}
            >
              {logo}
            </span>
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{dialogTitle ?? title}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </dialog>
      )}
    </article>
  );
}
