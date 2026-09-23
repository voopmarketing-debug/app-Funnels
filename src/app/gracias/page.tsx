import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

export default function GraciasPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <div className="fl-card-hero relative w-full max-w-sm space-y-5 p-7 text-center">
        <div className="flex items-center justify-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold">¡Gracias por tu compra!</h1>
          <p className="text-sm text-ink-muted">
            Ya estamos creando tu cuenta. En unos minutos te llega un correo con un enlace para elegir tu
            contraseña e iniciar sesión — revisa también spam por si acaso.
          </p>
        </div>

        {/* Primary CTA: this is the actual "activate your account" step —
            same one-time-link mechanism as "olvidé mi contraseña"
            (requestPasswordReset in lib/actions.ts), reused here so someone
            who just paid isn't stuck waiting on an email that might be
            delayed or land in spam. */}
        <Link
          href="/forgot-password"
          className="block w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Crear mi contraseña y entrar
        </Link>

        <Link
          href="/login"
          className="block w-full rounded-md border border-border-strong px-3 py-2 font-medium text-ink transition hover:border-accent"
        >
          Ya tengo mi contraseña, iniciar sesión
        </Link>

        <p className="text-center text-sm text-ink-muted">
          ¿Nada de esto funciona?{" "}
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
    </main>
  );
}
