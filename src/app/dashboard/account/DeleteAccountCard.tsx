"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/lib/accountDeletionActions";

export function DeleteAccountCard({ hasBusinesses, hasSubscription }: { hasBusinesses: boolean; hasSubscription: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteMyAccount(password);
      // On success the action signs you out and redirects: only an error comes back here.
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="fl-card space-y-3 border-error/30 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold text-ink">Eliminar mi cuenta</h2>
        <p className="text-xs text-ink-muted">
          Borra tu cuenta y tus datos
          {hasBusinesses ? ", incluidos tus negocios, conversaciones y contactos" : ""}
          {hasSubscription ? ". También cancelamos tu suscripción para que no te cobren más" : ""}. No se puede deshacer.
        </p>
      </div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-error/40 px-3 py-2 text-sm font-semibold text-error transition hover:bg-error/10"
        >
          Eliminar mi cuenta
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="deletePassword" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Escribe tu contraseña para confirmar
            </label>
            <input
              id="deletePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-error"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending || !password}
              className="rounded-md bg-error px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Eliminando…" : "Eliminar para siempre"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
              disabled={isPending}
              className="rounded-md border border-border px-4 py-2 text-sm text-ink-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
