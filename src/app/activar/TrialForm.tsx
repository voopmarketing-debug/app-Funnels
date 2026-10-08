"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startTrialCheckout, type TrialCheckoutState } from "@/lib/trialActions";

export function TrialForm({ supportLink }: { supportLink: string }) {
  const [state, formAction, isPending] = useActionState<TrialCheckoutState, FormData>(async (prev) => {
    try {
      return await startTrialCheckout();
    } catch (err) {
      // The redirect to Mercado Pago travels as a thrown signal: let it through.
      if (String((err as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT")) throw err;
      // Usually this page was opened before a new version of the app went
      // live and its button points at code that no longer exists: reload to
      // get the current page instead of a button that silently does nothing.
      window.location.reload();
      return prev;
    }
  }, { error: null });

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <div role="alert" className="space-y-2 rounded-xl border border-error/40 bg-error/10 p-3 text-sm">
          <p className="font-semibold text-ink">No pudimos abrir Mercado Pago</p>
          <p className="text-ink-muted">{state.error}</p>
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            Escribir por WhatsApp →
          </a>
          {state.detail && <p className="break-words text-[11px] text-ink-faint">Código para soporte: {state.detail}</p>}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Abriendo Mercado Pago…" : state.error ? "Intentar de nuevo" : "Registrar mi tarjeta y empezar gratis"}
      </button>
    </form>
  );
}

/** Back from Mercado Pago: the webhook may take a few seconds; keep checking. */
export function WaitForActivation({ supportLink }: { supportLink: string }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const tick = setInterval(() => router.refresh(), 3000);
    const late = setTimeout(() => setSlow(true), 60_000);
    return () => {
      clearInterval(tick);
      clearTimeout(late);
    };
  }, [router]);
  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-accent/30 border-t-accent" aria-hidden="true" />
      <h1 className="text-xl font-bold">Confirmando con Mercado Pago…</h1>
      <p className="text-sm text-ink-muted">Esto tarda unos segundos. No cierres esta página.</p>
      {slow && (
        <p className="text-sm text-ink-muted">
          Está tardando más de lo normal. Si ya registraste tu tarjeta,{" "}
          <a href={supportLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            escríbenos por WhatsApp
          </a>{" "}
          y lo activamos de inmediato.
        </p>
      )}
    </div>
  );
}
