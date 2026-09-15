"use client";

import { useActionState } from "react";
import { updateOwnProfile, type UpdateProfileState } from "@/lib/actions";

export function AccountForm({ email, name }: { email: string; name: string }) {
  const [state, formAction, isPending] = useActionState<UpdateProfileState, FormData>(
    updateOwnProfile,
    { error: null, saved: false },
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="space-y-1">
        <label className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Email</label>
        <p className="rounded-md border border-border bg-background px-3 py-2 text-ink-muted">{email}</p>
        <p className="text-xs text-ink-muted">El correo de acceso no se puede cambiar aquí.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          required
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
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        {state.saved && !isPending && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
      </div>
    </form>
  );
}
