"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword, type ChangePasswordState } from "@/lib/actions";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<ChangePasswordState, FormData>(changeOwnPassword, {
    error: null,
    saved: false,
  });

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state.saved]);

  return (
    <form ref={formRef} action={formAction} className="fl-card max-w-sm space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-ink">Cambiar contraseña</h2>
        <p className="text-xs text-ink-muted">
          Si la agencia te dio una contraseña temporal, aquí puedes cambiarla por una tuya.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="currentPassword" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Contraseña actual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="newPassword" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nueva contraseña
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
        <p className="text-xs text-ink-muted">Mínimo 8 caracteres.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Confirmar nueva contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Actualizar contraseña"}
        </button>
        {state.saved && !isPending && <span className="fl-mono text-xs text-accent">✓ Actualizada</span>}
      </div>
    </form>
  );
}
