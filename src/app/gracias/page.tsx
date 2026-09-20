import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

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

        <Link
          href="/login"
          className="block w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Ya tengo mi contraseña, iniciar sesión
        </Link>

        <p className="text-center text-sm text-ink-muted">
          ¿No te llegó el correo?{" "}
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
