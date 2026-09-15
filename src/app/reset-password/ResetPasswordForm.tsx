"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type ResetPasswordState } from "@/lib/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    { error: null },
  );

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-error">
          Este enlace no es válido. Solicita uno nuevo desde &quot;¿Olvidaste tu contraseña?&quot;.
        </p>
        <Link href="/forgot-password" className="text-sm text-accent hover:underline">
          Solicitar un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1">
        <label htmlFor="password" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
        <p className="text-xs text-ink-muted">Mínimo 8 caracteres.</p>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
