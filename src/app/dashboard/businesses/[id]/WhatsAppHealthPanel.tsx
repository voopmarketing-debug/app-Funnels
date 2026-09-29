"use client";

import { useState, useTransition } from "react";
import { checkWhatsAppConnection, reconnectWhatsAppWebhook } from "@/lib/actions";
import type { WhatsAppHealth } from "@/lib/whatsappHealth";
import { ClientDate } from "@/components/ClientDate";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };

// "Estado de WhatsApp": the one place that answers "is WhatsApp actually
// reaching us?". Shows the last event Meta delivered, the last receive error,
// the stored result of the daily check, and lets the owner re-run it or
// re-subscribe the app to the number (the usual fix when messages vanish).
export function WhatsAppHealthPanel({
  businessId,
  lastWebhookAt,
  webhookError,
  webhookErrorAt,
  healthOk,
  healthMessage,
  healthCheckedAt,
}: {
  businessId: string;
  lastWebhookAt: Date | null;
  webhookError: string | null;
  webhookErrorAt: Date | null;
  healthOk: boolean | null;
  healthMessage: string | null;
  healthCheckedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [health, setHealth] = useState<WhatsAppHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnected, setReconnected] = useState(false);

  // The page only passes a receive error from the last 24h (see isRecentWebhookError).
  const recentError = !!(webhookError && webhookErrorAt);
  const ok = health ? health.ok : healthOk !== false && !recentError;

  function runCheck() {
    setError(null);
    setReconnected(false);
    startTransition(async () => {
      try {
        setHealth(await checkWhatsAppConnection(businessId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo revisar la conexión");
      }
    });
  }

  function reconnect() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await reconnectWhatsAppWebhook(businessId);
        if (!result.ok) {
          setError(result.error ?? "Meta rechazó la reconexión");
          return;
        }
        setReconnected(true);
        if (result.health) setHealth(result.health);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo reconectar");
      }
    });
  }

  return (
    <section className={`fl-card space-y-3 p-4 ${ok ? "" : "border-error/50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-accent" : "animate-pulse bg-error"}`} />
          <h2 className="text-sm font-semibold text-ink">Estado de WhatsApp</h2>
          <span className={`text-xs font-medium ${ok ? "text-accent" : "text-error"}`}>
            {ok ? "Funcionando" : "Requiere atención"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {health?.canResubscribe && (
            <button
              type="button"
              onClick={reconnect}
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              Reconectar recepción de mensajes
            </button>
          )}
          <button
            type="button"
            onClick={runCheck}
            disabled={isPending}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {isPending ? "Revisando..." : "Revisar conexión ahora"}
          </button>
        </div>
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-ink-faint">Último mensaje o evento recibido de Meta</dt>
          <dd className="text-ink">{lastWebhookAt ? <ClientDate date={lastWebhookAt} options={DATE_OPTIONS} /> : "Aún no registrado"}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Última revisión automática</dt>
          <dd className="text-ink">
            {healthCheckedAt ? (
              <>
                <ClientDate date={healthCheckedAt} options={DATE_OPTIONS} /> · {healthOk ? "OK" : healthMessage}
              </>
            ) : (
              "Todavía no se ha revisado"
            )}
          </dd>
        </div>
      </dl>

      {recentError && !health && (
        <p className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
          <ClientDate date={webhookErrorAt!} options={DATE_OPTIONS} /> · {webhookError}
        </p>
      )}

      {health && (
        <ul className="space-y-1.5">
          {health.checks.map((c) => (
            <li key={c.label} className="flex gap-2 text-xs">
              <span className={c.ok ? "text-accent" : "text-error"}>{c.ok ? "✓" : "✕"}</span>
              <span>
                <span className="font-semibold text-ink">{c.label}:</span> <span className="text-ink-muted">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {reconnected && <p className="text-xs text-accent">✓ Reconectado. Pídele a alguien que escriba de nuevo para confirmar.</p>}
      {error && <p className="text-xs font-medium text-error">{error}</p>}

      <p className="text-[11px] text-ink-faint">
        Se revisa sola todos los días. Si algo falla, te avisamos en la campana y por correo.
      </p>
    </section>
  );
}
