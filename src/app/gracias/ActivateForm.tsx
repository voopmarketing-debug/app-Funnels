"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/actions";

/** Sends the "create your password" link right from the thank-you page. */
export function ActivateForm() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(requestPasswordReset, { submitted: false });

  if (state.submitted) {
    return (
      <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-ink">
        Listo. Si ese correo es el de tu compra, te llega el enlace en un par de minutos. Revisa también spam o promociones.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="email" className="block text-sm font-medium text-ink">
        ¿No te llegó el correo? Escribe el que usaste al pagar
      </label>
      <div className="flex gap-2">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex-none rounded-md border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-60"
        >
          {isPending ? "Enviando…" : "Reenviar"}
        </button>
      </div>
    </form>
  );
}
