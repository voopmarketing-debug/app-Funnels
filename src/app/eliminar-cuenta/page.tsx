import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

export const metadata = {
  title: "Eliminar mi cuenta — Funnels Labs",
};

// Public page the app stores ask for: how a person deletes their account and what happens to their data.
export default function DeleteAccountPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </Link>

        <div className="fl-card-hero mt-8 space-y-6 p-7">
          <h1 className="text-2xl font-bold text-ink">Eliminar mi cuenta</h1>

          <section className="space-y-2">
            <h2 className="font-semibold text-ink">Cómo hacerlo</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink">
              <li>
                Entra a tu cuenta en{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Funnels Labs
                </Link>
                , desde la app o desde la web.
              </li>
              <li>Abre «Mi perfil».</li>
              <li>Baja hasta «Eliminar mi cuenta», escribe tu contraseña y confirma.</li>
            </ol>
            <p className="text-sm leading-relaxed text-ink-muted">
              Si no puedes entrar a tu cuenta, escríbenos al correo{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              o por{" "}
              <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                WhatsApp
              </a>
              , desde el correo con el que te registraste, y la eliminamos por ti.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-ink">Qué se borra</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
              <li>Tu cuenta: nombre, correo y contraseña.</li>
              <li>Tus negocios y todo lo que hay en ellos: conversaciones, contactos, flujos, plantillas y páginas.</li>
              <li>Tu suscripción de Mercado Pago se cancela para que no te cobren más.</li>
            </ul>
            <p className="text-sm leading-relaxed text-ink-muted">
              Es definitivo y no se puede deshacer. Los mensajes que viven en WhatsApp o en la cuenta de Meta de tu negocio no los controlamos
              nosotros: bórralos desde allí si lo necesitas.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
