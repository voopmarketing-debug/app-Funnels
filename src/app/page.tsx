import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

const SEGMENTS = [
  {
    title: "Clínicas y consultorios",
    text: "Agenda citas, responde precios y horarios, y filtra pacientes sin que tu recepción se sature.",
  },
  {
    title: "Coaches y consultores",
    text: "Califica leads antes de la llamada de ventas y responde las mismas preguntas de siempre, automáticamente.",
  },
  {
    title: "Ecommerce",
    text: "Soporte y seguimiento de pedidos 24/7, sin que un cliente se quede esperando de un día para otro.",
  },
  {
    title: "Clientes de Funnels Labs",
    text: "Suma un agente de IA a tu embudo y tu pauta — el mismo equipo que ya te lleva el growth.",
  },
];

const STEPS = [
  { n: "1", title: "Crea tu cuenta", text: "Te registras con el nombre de tu negocio y tu correo." },
  { n: "2", title: "Conectamos tu WhatsApp", text: "En una llamada de 30-45 min, con la API oficial de Meta." },
  { n: "3", title: "Configuras tu agente", text: "Tono, tipo de negocio, y qué debe saber sobre ti." },
  { n: "4", title: "Responde 24/7", text: "Tu agente atiende a tus clientes, tú ves todo desde el panel." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative overflow-hidden">
      <div className="fl-grid-bg pointer-events-none absolute inset-0 h-[40rem]" />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink">
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
        <p className="fl-mono mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Agentes de IA para WhatsApp
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Tu negocio, respondiendo en WhatsApp 24/7 con Inteligencia Artificial
        </h1>
        <p className="mt-5 text-lg text-ink-muted">
          Conectamos tu WhatsApp Business a un agente de IA (Claude, de Anthropic) que responde a
          tus clientes con tu tono, tu información y sin dejarlos esperando. Sin riesgo de bloqueo
          — usamos la API oficial de Meta.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="w-full rounded-md bg-accent px-5 py-3 text-center font-semibold text-accent-ink transition hover:bg-accent-hover sm:w-auto"
          >
            Crear mi cuenta
          </Link>
          <a
            href="#precios"
            className="w-full rounded-md border border-border px-5 py-3 text-center font-semibold text-ink transition hover:border-border-strong sm:w-auto"
          >
            Ver planes
          </a>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-muted">
          ¿Para quién es?
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-surface p-5">
              <p className="font-semibold">{s.title}</p>
              <p className="mt-2 text-sm text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Cómo funciona
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="fl-mono flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                {s.n}
              </div>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="precios" className="relative mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">Planes</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-muted">
          Incluyen implementación (conexión de tu WhatsApp, configuración del agente y prueba en
          vivo) más mantenimiento mensual. Precios de referencia en USD.
        </p>

        <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="fl-mono text-xs uppercase tracking-wide text-ink-muted">Starter</p>
            <p className="mt-2 text-3xl font-bold">$49<span className="text-base font-normal text-ink-muted">/mes</span></p>
            <p className="mt-1 text-sm text-ink-muted">+ $97 implementación única</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-muted">
              <li>1 número de WhatsApp</li>
              <li>Hasta ~500 conversaciones/mes</li>
              <li>Tono y prompt configurables</li>
              <li>Soporte por email</li>
            </ul>
            <Link
              href="/register"
              className="mt-6 block rounded-md border border-border px-4 py-2 text-center font-semibold text-ink transition hover:border-border-strong"
            >
              Empezar
            </Link>
          </div>

          <div className="rounded-xl border-2 border-accent bg-surface p-6">
            <p className="fl-mono text-xs uppercase tracking-wide text-accent">Pro</p>
            <p className="mt-2 text-3xl font-bold">$99<span className="text-base font-normal text-ink-muted">/mes</span></p>
            <p className="mt-1 text-sm text-ink-muted">+ $97 implementación única</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-muted">
              <li>1 número de WhatsApp</li>
              <li>Conversaciones ilimitadas</li>
              <li>Ajuste de prompt mensual incluido</li>
              <li>Soporte prioritario</li>
            </ul>
            <Link
              href="/register"
              className="mt-6 block rounded-md bg-accent px-4 py-2 text-center font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              Empezar
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          ¿Varios negocios o sucursales?{" "}
          <a href="mailto:voopmarketing@gmail.com" className="text-accent hover:underline">
            Escríbenos
          </a>{" "}
          para un plan a la medida.
        </p>
      </section>

      <footer className="relative border-t border-border px-6 py-8 text-center text-sm text-ink-muted">
        Funnels Labs — growth partner para coaches, clínicas, ecommerce y SaaS en LATAM.
      </footer>
    </main>
  );
}
