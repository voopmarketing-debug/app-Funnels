"use client";

import { useState, useTransition } from "react";
import { cancelMySubscription } from "@/lib/subscriptionActions";

/** "Mi suscripción" in Mi perfil: plan, next charge and the cancel button. */
export function SubscriptionCard({
  planLabel,
  status,
  accessUntil,
  nextCharge,
  inTrial,
  supportLink,
}: {
  planLabel: string;
  status: "active" | "cancelled" | "unknown";
  accessUntil: string | null;
  nextCharge: string | null;
  inTrial: boolean;
  supportLink: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(status === "cancelled");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelMySubscription();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCancelled(true);
      setConfirming(false);
    });
  }

  return (
    <section className="fl-card space-y-3 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-ink">💳 Mi suscripción</h2>
          <p className="text-xs text-ink-muted">Plan {planLabel} · cobro mensual con Mercado Pago</p>
        </div>
        <span
          className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
            cancelled ? "bg-error/15 text-error" : "bg-[var(--status-good)]/15 text-[var(--status-good)]"
          }`}
        >
          {cancelled ? "Cancelada" : inTrial ? "● Prueba gratis" : "● Activa"}
        </span>
      </div>

      {cancelled ? (
        <p className="text-sm text-ink-muted">
          No se te volverá a cobrar.{accessUntil && <> Puedes seguir usando tu panel hasta el <strong className="text-ink">{accessUntil}</strong>.</>}{" "}
          Tus datos se guardan: si vuelves, todo sigue ahí.{" "}
          <a href={supportLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            ¿Quieres reactivarla? Escríbenos
          </a>
        </p>
      ) : (
        <dl className="space-y-1 text-sm">
          {nextCharge && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">{inTrial ? "Primer cobro" : "Próximo cobro"}</dt>
              <dd className="font-semibold text-ink">{nextCharge}</dd>
            </div>
          )}
          {status === "unknown" && <p className="text-xs text-ink-faint">No pudimos consultar Mercado Pago en este momento.</p>}
        </dl>
      )}

      {!cancelled &&
        (confirming ? (
          <div className="space-y-2 rounded-lg border border-error/40 bg-error/5 p-3 text-sm">
            <p className="text-ink">
              <strong>¿Cancelar tu suscripción?</strong> No se te cobrará más
              {accessUntil ? <> y mantienes el acceso hasta el {accessUntil}</> : null}. Después tu agente deja de responder, pero tus
              datos y conversaciones se guardan.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={isPending}
                className="rounded-md bg-error px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "Cancelando…" : "Sí, cancelar"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                No, mantenerla
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="text-sm text-ink-muted underline hover:text-error">
            Cancelar suscripción
          </button>
        ))}
      {error && <p className="text-sm text-error">⚠ {error}</p>}
    </section>
  );
}
