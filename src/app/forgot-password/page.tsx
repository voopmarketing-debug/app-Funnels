"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/actions";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    { submitted: false },
  );

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-sm space-y-6 rounded-xl border border-border bg-surface p-7">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Recuperar contraseña</h1>
          <p className="text-sm text-ink-muted">
            Escribe tu correo y te enviamos un enlace para elegir una nueva contraseña.
          </p>
        </div>

        {state.submitted ? (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Si ese correo está registrado, te llegará un enlace en unos minutos. Revisa también la
            carpeta de spam.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ink-muted">
          <Link href="/login" className="text-accent hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
