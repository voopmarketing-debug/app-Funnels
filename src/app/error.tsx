"use client";

import { useEffect } from "react";

// After we publish an update, a page that was already open still points to the
// old version: its buttons call actions (or load scripts) that no longer exist.
// The fix is to load the page again, so that case reloads by itself, once.
function isStaleVersionError(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return /Server Action|failed-to-find-server-action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(text);
}

const RELOAD_KEY = "fl-stale-reload";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleVersionError(error);

  useEffect(() => {
    if (!stale) return;
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      // Once per minute at most: if it keeps failing after a reload, the person sees the message.
      if (Date.now() - last < 60_000) return;
      window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // No storage: skip the automatic reload, the button below does the same.
      return;
    }
    window.location.reload();
  }, [stale]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="fl-card-hero w-full max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/15 text-2xl">{stale ? "🔄" : "⚠️"}</div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold">{stale ? "Actualizamos la plataforma" : "Algo salió mal"}</h1>
          <p className="text-sm text-ink-muted">
            {stale
              ? "Mientras tenías esta página abierta publicamos una mejora. Recárgala para seguir; no se perdió nada de lo que ya estaba guardado."
              : "Ocurrió un error inesperado. Intenta de nuevo y, si sigue pasando, escríbenos con el código de abajo."}
          </p>
          {!stale && error.digest && <p className="fl-mono text-xs text-ink-faint">Código: {error.digest}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => (stale ? window.location.reload() : reset())}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            {stale ? "Recargar la página" : "Reintentar"}
          </button>
          <a href="/dashboard" className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent">
            Volver al panel
          </a>
        </div>
      </div>
    </div>
  );
}
