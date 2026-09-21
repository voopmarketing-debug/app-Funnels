"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="fl-card-hero w-full max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/15 text-2xl">
          ⚠️
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold">Algo salió mal</h1>
          <p className="text-sm text-ink-muted">
            {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
          </p>
          {error.digest && <p className="fl-mono text-xs text-ink-faint">Código: {error.digest}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Volver al panel
          </a>
        </div>
      </div>
    </div>
  );
}
