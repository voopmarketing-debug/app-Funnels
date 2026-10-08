"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startTrialCheckout, type TrialCheckoutState } from "@/lib/trialActions";

const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;

export function TrialForm({ plans }: { plans: { key: string; name: string; priceCop: number; detail: string }[] }) {
  const [state, formAction, isPending] = useActionState<TrialCheckoutState, FormData>(startTrialCheckout, { error: null });
  const [plan, setPlan] = useState(plans[0].key);

  return (
    <form action={formAction} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="sr-only">Elige tu plan</legend>
        {plans.map((p) => (
          <label
            key={p.key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${plan === p.key ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"}`}
          >
            <input type="radio" name="plan" value={p.key} checked={plan === p.key} onChange={() => setPlan(p.key)} className="mt-1 accent-[var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-ink">
                  <strong>{cop(p.priceCop)}</strong>
                  <span className="text-ink-muted"> /mes</span>
                </span>
              </span>
              <span className="block text-xs text-ink-muted">{p.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Abriendo Mercado Pago…" : "Registrar mi tarjeta y empezar gratis"}
      </button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
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
