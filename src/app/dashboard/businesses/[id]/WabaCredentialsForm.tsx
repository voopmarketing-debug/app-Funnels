"use client";

import { useActionState } from "react";
import { updateWabaCredentials } from "@/lib/actions";

type SaveState = { saved: boolean };

export function WabaCredentialsForm({
  businessId,
  wabaPhoneNumberId,
  wabaId,
}: {
  businessId: string;
  wabaPhoneNumberId: string;
  wabaId: string;
}) {
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    async (_prevState, formData) => {
      await updateWabaCredentials(businessId, formData);
      return { saved: true };
    },
    { saved: false },
  );

  return (
    <details
      open
      className="group self-start rounded-md border-2 border-[#fab219]/50 bg-surface p-4"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 fl-mono text-xs tracking-wide text-ink uppercase [&::-webkit-details-marker]:hidden">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#fab219] text-[11px] font-bold text-black">
          !
        </span>
        <span className="flex-1">Credenciales de WhatsApp — paso obligatorio</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 flex-none text-[#fab219] transition-transform group-open:rotate-180"
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <p className="mt-3 text-sm text-ink">
        Sin esto bien puesto, tu agente de IA <strong>no puede enviar ni recibir</strong> mensajes
        de WhatsApp. Los dos datos de abajo no te los inventas tú: te los entrega Meta (el dueño de
        WhatsApp) cuando conectas tu número al WhatsApp Business API. Sigue los pasos:
      </p>

      <form action={formAction} className="mt-4 space-y-5">
        <div className="space-y-1">
          <label htmlFor="wabaPhoneNumberId" className="fl-mono text-xs tracking-wide text-ink uppercase">
            1. Phone Number ID (te lo da Meta)
          </label>
          <p className="text-xs text-ink-muted">
            Es el identificador que Meta le asigna a tu número dentro de WhatsApp Business API — no
            es tu número de teléfono normal. Lo encuentras entrando a{" "}
            <span className="fl-mono text-ink">business.facebook.com → WhatsApp Manager</span>, en{" "}
            <span className="fl-mono text-ink">Configuración de la API → Números de teléfono</span>{" "}
            (ahí dice &quot;Phone number ID&quot;). Cópialo y pégalo tal cual aquí abajo.
          </p>
          <input
            id="wabaPhoneNumberId"
            name="wabaPhoneNumberId"
            defaultValue={wabaPhoneNumberId}
            required
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="wabaAccessToken" className="fl-mono text-xs tracking-wide text-ink uppercase">
            2. Token de acceso (te lo da Meta)
          </label>
          <p className="text-xs text-ink-muted">
            Es la clave secreta que autoriza a tu agente de IA a usar tu WhatsApp. También la
            genera Meta, en{" "}
            <span className="fl-mono text-ink">developers.facebook.com → tu App → WhatsApp → Configuración de la API</span>
            . Ya está guardado uno funcionando — solo tienes que pegar uno nuevo aquí{" "}
            <strong>cuando Meta te avise que venció</strong> (con tokens de prueba, cada ~24 horas).
            Cuando eso pase, hacerlo es obligatorio: si no actualizas el token, el agente deja de
            responder en WhatsApp.
          </p>
          <input
            id="wabaAccessToken"
            name="wabaAccessToken"
            type="text"
            placeholder="Pega aquí el token nuevo que te dio Meta"
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="wabaId" className="fl-mono text-xs tracking-wide text-ink uppercase">
            3. WABA ID (solo si vas a usar plantillas de difusión)
          </label>
          <p className="text-xs text-ink-muted">
            Es el ID de tu cuenta de WhatsApp Business (distinto al Phone Number ID de arriba) — solo hace falta
            para crear <strong>plantillas de mensajes</strong> (ver sección Plantillas), no para el agente normal.
            Lo encuentras en{" "}
            <span className="fl-mono text-ink">business.facebook.com → WhatsApp Manager → Configuración de la API</span>{" "}
            (ahí dice &quot;ID de la cuenta de WhatsApp Business&quot;).
          </p>
          <input
            id="wabaId"
            name="wabaId"
            defaultValue={wabaId}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar credenciales"}
          </button>
          {state.saved && !isPending && (
            <span className="fl-mono text-xs text-accent">✓ Guardado</span>
          )}
        </div>
      </form>
    </details>
  );
}
