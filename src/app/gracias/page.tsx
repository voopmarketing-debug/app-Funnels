import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { ActivateForm } from "./ActivateForm";

// The buyer lands here after paying (set this URL as the success / thank-you
// page of the Mercado Pago link or subscription plan). The account is created by the payment webhook (see
// lib/payments.ts) and the activation link goes to the purchase email, so
// this page's only job is getting them to that first login + onboarding.
export default function GraciasPage() {
  const steps = [
    { title: "Revisa tu correo", text: "Te enviamos un enlace para crear tu contraseña. Llega en 1 o 2 minutos (mira también spam)." },
    { title: "Crea tu contraseña y entra", text: "Tu cuenta ya está activa: tu plan y tu membresía se activaron solos con el pago." },
    { title: "Agenda tu sesión de inicio", text: "En 30-45 minutos conectamos tu WhatsApp y dejamos tu agente respondiendo." },
  ];

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <div className="fl-card-hero relative w-full max-w-md space-y-6 p-7">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Pago confirmado</p>
          <h1 className="text-2xl font-bold leading-tight">¡Bienvenido! Tu agente de IA está a 3 pasos</h1>
        </div>

        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{i + 1}</span>
              <span>
                <span className="block font-semibold text-ink">{s.title}</span>
                <span className="block text-sm text-ink-muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-md bg-accent px-3 py-2.5 text-center font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Agendar mi sesión de inicio por WhatsApp
          </a>
          <Link
            href="/login"
            className="block w-full rounded-md border border-border-strong px-3 py-2.5 text-center font-medium text-ink transition hover:border-accent"
          >
            Ya creé mi contraseña, iniciar sesión
          </Link>
        </div>

        <div className="border-t border-border pt-5">
          <ActivateForm />
        </div>
      </div>
    </main>
  );
}
