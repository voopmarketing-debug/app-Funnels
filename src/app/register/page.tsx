"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerBusiness, type RegisterState } from "@/lib/actions";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { SignupShell, TrustChips, CheckList } from "@/components/SignupShell";
import { TRIAL_DAYS } from "@/lib/plans";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(
    registerBusiness,
    { error: null },
  );

  return (
    <SignupShell
      step={1}
      topRight={<ThemeToggle className="fl-nav-icon" />}
      aside={
        <>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight text-ink [text-wrap:balance]">
              Tu agente de IA vendiendo por WhatsApp, 24/7
            </h2>
            <p className="text-ink-muted">Responde, califica y agenda a tus clientes mientras tú te enfocas en tu negocio.</p>
          </div>
          <CheckList
            items={[
              "Responde al instante, con el tono de tu marca",
              "CRM con embudos para no perder ningún cliente",
              "Páginas web y KPIs creados con IA",
              "Te acompañamos a conectar tu WhatsApp",
            ]}
          />
          <ol className="space-y-3 rounded-xl border border-border bg-surface/60 p-4 text-sm">
            {[
              ["Crea tu cuenta", "1 minuto"],
              [`Activa tus ${TRIAL_DAYS} días gratis`, "sin cobro hoy"],
              ["Conectamos tu WhatsApp", "sesión de 30-45 min"],
            ].map(([t, d], i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{i + 1}</span>
                <span className="font-medium text-ink">{t}</span>
                <span className="ml-auto text-xs text-ink-muted">{d}</span>
              </li>
            ))}
          </ol>
        </>
      }
    >
      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
          <p className="text-sm text-ink-muted">En el siguiente paso activas tu prueba gratis.</p>
          <div className="lg:hidden">
            <TrustChips items={[`${TRIAL_DAYS} días gratis`, "Sin cobro hoy", "Cancela cuando quieras"]} />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Nombre de tu negocio
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Clínica Sonrisa"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="industry" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Tipo de negocio
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue="otro"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

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

        <div className="space-y-1">
          <label htmlFor="phone" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            WhatsApp / teléfono de contacto
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="+57 300 123 4567"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <p className="text-xs text-ink-muted">Para contactarte sobre tu cuenta y la conexión de tu WhatsApp.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <p className="text-xs text-ink-muted">Mínimo 8 caracteres.</p>
        </div>

        {state.error === "EMAIL_TAKEN" ? (
          <div role="alert" className="space-y-1 rounded-lg border border-error/40 bg-error/10 p-3 text-sm">
            <p className="font-semibold text-ink">Ese correo ya tiene una cuenta</p>
            <p className="text-ink-muted">
              <Link href="/login" className="font-semibold text-accent hover:underline">
                Inicia sesión
              </Link>{" "}
              o{" "}
              <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
                recupera tu contraseña
              </Link>
              . Si quieres crear otra cuenta, usa un correo distinto.
            </p>
          </div>
        ) : (
          state.error && <p className="text-sm text-error">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-ink-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Inicia sesión
          </Link>
        </p>

        <p className="text-center text-sm text-ink-muted">
          ¿Necesitas ayuda?{" "}
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </form>
    </SignupShell>
  );
}
