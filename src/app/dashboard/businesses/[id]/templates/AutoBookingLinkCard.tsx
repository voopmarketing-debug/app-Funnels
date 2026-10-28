"use client";

import { useState, useTransition } from "react";
import { setAutoBookingLink } from "@/lib/bookingLinkActions";

/**
 * The switch for the automatic "link_agendamiento" follow-up. Says in plain
 * words who gets the message and who never does, and what it needs to work.
 */
export function AutoBookingLinkCard({
  businessId,
  enabled,
  hasAgendaPage,
  templateReady,
  canChange,
}: {
  businessId: string;
  enabled: boolean;
  hasAgendaPage: boolean;
  templateReady: boolean;
  canChange: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      const res = await setAutoBookingLink(businessId, next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="fl-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Enviar el enlace de agenda automáticamente</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            A quien dejó sus datos en tu página y <strong className="text-ink">no agendó en 24 horas</strong>, le enviamos <strong className="text-ink">una sola vez</strong> el enlace de tu agenda con la plantilla <span className="fl-mono">link_agendamiento</span>.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Enviar el enlace de agenda automáticamente"
          onClick={toggle}
          disabled={!canChange || pending}
          className={`relative mt-0.5 h-7 w-12 flex-none rounded-full border transition disabled:opacity-60 ${on ? "border-accent bg-accent" : "border-border-strong bg-surface-2"}`}
        >
          <span className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <ul className="space-y-1 text-[13px] text-ink-muted">
        <li>✓ Solo entre las 9 a. m. y las 7 p. m. de tu agenda.</li>
        <li>✓ No se envía a quien ya agendó, ya te escribió o ya está siendo atendido por una persona.</li>
        <li>✓ Máximo 30 mensajes por día.</li>
      </ul>

      {on && !hasAgendaPage && <p className="rounded-lg border border-[#fab219]/50 bg-[#fab219]/10 px-3 py-2 text-sm text-ink">Falta una página de agenda: sin ella no hay enlace que enviar. Crea una en <strong>Sitio web</strong>.</p>}
      {on && hasAgendaPage && !templateReady && (
        <p className="rounded-lg border border-[#fab219]/50 bg-[#fab219]/10 px-3 py-2 text-sm text-ink">
          Todavía no veo la plantilla <span className="fl-mono">link_agendamiento</span> aprobada aquí. Créala abajo con {"{{1}}"} para el nombre y {"{{2}}"} para el enlace; hasta que esté aprobada no se envía nada.
        </p>
      )}
      {error && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
      {!canChange && <p className="text-xs text-ink-faint">Solo el dueño o la agencia pueden cambiar esto.</p>}
    </div>
  );
}
