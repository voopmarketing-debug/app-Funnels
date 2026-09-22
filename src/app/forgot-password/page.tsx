"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/actions";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    { submitted: false },
  );

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />
      <ThemeToggle className="fl-nav-icon absolute right-4 top-4 z-10" />

      <div className="relative w-full max-w-sm space-y-6 fl-card-hero p-7">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Crear o recuperar tu contraseña</h1>
          <p className="text-sm text-ink-muted">
            Escribe tu correo y te enviamos un enlace para elegir tu contraseña e iniciar sesión — sirve tanto si
            acabas de comprar y aún no tienes una, como si olvidaste la tuya.
          </p>
        </div>

        {state.submitted ? (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Si ese correo está registrado, te llegará un enlace en unos minutos. Revisa también la
            carpeta de spam.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
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

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}

        <div className="space-y-1 text-center text-sm text-ink-muted">
          <p>
            <Link href="/login" className="text-accent hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
          <p>
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
        </div>
      </div>
    </main>
  );
}
