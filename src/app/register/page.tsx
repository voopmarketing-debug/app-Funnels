"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerBusiness, type RegisterState } from "@/lib/actions";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(
    registerBusiness,
    { error: null },
  );

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />
      <ThemeToggle className="fl-nav-icon absolute right-4 top-4 z-10" />

      <form
        action={formAction}
        className="relative w-full max-w-sm space-y-5 fl-card-hero p-7"
      >
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Crea tu cuenta</h1>
          <p className="text-sm text-ink-muted">Tu agente de IA para WhatsApp, en minutos.</p>
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

        {state.error && <p className="text-sm text-error">{state.error}</p>}

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
    </main>
  );
}
