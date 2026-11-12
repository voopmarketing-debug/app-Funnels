"use client";

import { useActionState } from "react";
import { startRenewal, type RenewalState } from "@/lib/renewalActions";

/** The two ways to renew from the expired-plan screen: a button each, nothing to read. */
export function RenewButtons({ priceLabel, supportLink }: { priceLabel: string; supportLink: string }) {
  const [state, formAction, isPending] = useActionState<RenewalState, FormData>(async (prev, formData) => {
    try {
      return await startRenewal(formData.get("kind") === "month" ? "month" : "card");
    } catch (err) {
      // The redirect to Mercado Pago travels as a thrown signal: let it through.
      if (String((err as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT")) throw err;
      // The page was opened before a new version went live: reload to get the current one.
      window.location.reload();
      return prev;
    }
  }, { error: null });

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-ink">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        name="kind"
        value="card"
        disabled={isPending}
        className="w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Abriendo Mercado Pago…" : "Renovar con tarjeta"}
        <span className="block text-xs font-normal opacity-80">{priceLabel} · se renueva solo cada mes</span>
      </button>
      <button
        type="submit"
        name="kind"
        value="month"
        disabled={isPending}
        className="w-full rounded-xl border border-border-strong px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-60"
      >
        Pagar solo este mes
        <span className="block text-xs font-normal text-ink-muted">Tarjeta, PSE o Nequi</span>
      </button>
      <a href={supportLink} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-ink-muted underline hover:text-ink">
        Hablar con soporte
      </a>
    </form>
  );
}
