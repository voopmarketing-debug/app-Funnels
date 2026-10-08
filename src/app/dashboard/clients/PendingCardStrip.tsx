"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateWithoutCard } from "@/lib/salesActions";

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `57${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

/** Sales follow-up for a sign-up that never registered a card. */
export function PendingCardStrip({
  userId,
  name,
  business,
  phone,
  openedCheckout,
  activationUrl,
}: {
  userId: string;
  name: string;
  business: string;
  phone: string | null;
  openedCheckout: boolean;
  activationUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const message = `Hola ${name.split(" ")[0]}, te escribo de Funnels Labs 👋 Vi que creaste tu cuenta para ${business}. ¿Te ayudo a activar tus días gratis y dejar tu agente de IA respondiendo en WhatsApp? Solo falta registrar la tarjeta aquí (no se cobra nada hoy): ${activationUrl}`;

  function activate() {
    setError(null);
    startTransition(async () => {
      const res = await activateWithoutCard(userId, days);
      if (!res.ok) setError(res.error ?? "No se pudo activar");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-[#6366f1]/30 bg-[#6366f1]/10 px-4 py-3 text-sm">
      <p className="text-ink">
        <strong>Se registró pero no registró su tarjeta</strong>
        {openedCheckout ? " · abrió Mercado Pago y no terminó." : " · no ha abierto Mercado Pago."} Escríbele para cerrarlo.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {phone && (
          <a
            href={waLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Escribir por WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(activationUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent"
        >
          {copied ? "¡Enlace copiado!" : "Copiar enlace para activar"}
        </button>
        <span className="flex items-center gap-1.5">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Días de acceso"
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
          </select>
          <button
            type="button"
            onClick={activate}
            disabled={pending}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-60"
          >
            {pending ? "Activando…" : "Activar sin tarjeta"}
          </button>
        </span>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
