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

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

const PLANS = [
  {
    name: "Starter",
    badge: "Oferta de lanzamiento",
    price: "$150",
    priceSuffix: "USD todo el trimestre",
    strikePrice: "$450",
    billingNote:
      "El plan normal es $150 USD/mes. Por el lanzamiento del software te lo dejamos en $150 USD por los 3 meses completos — pago único, sin mensualidades en ese periodo. Se cobra automático cada trimestre (vía Hotmart).",
    contacts: "Hasta 400 contactos activos/mes",
    features: [
      "1 línea de WhatsApp (un negocio)",
      "Agente con memoria completa de la conversación",
      "CRM personalizable por etapas",
      "Soporte de lunes a viernes por WhatsApp con un agente especializado",
      "Sesión de onboarding y acompañamiento",
    ],
    highlight: false,
    ctaLabel: "Empezar",
    ctaHref: "/register",
  },
  {
    name: "Pro",
    price: "$300",
    priceSuffix: "USD cada 3 meses",
    billingNote: "Cobro automático trimestral (vía Hotmart) — mínimo 3 meses.",
    contacts: "Hasta 1,200 contactos activos/mes",
    features: [
      "Hasta 3 líneas de WhatsApp en total",
      "Dashboard de KPIs + diagnóstico de ventas con IA",
      "Ajuste de prompt mensual incluido",
      "Soporte de lunes a viernes por WhatsApp con un agente especializado",
      "Sesión de onboarding y acompañamiento",
    ],
    highlight: true,
    ctaLabel: "Empezar",
    ctaHref: "/register",
  },
  {
    name: "Consultoría",
    price: "Llave en mano",
    priceSuffix: "",
    billingNote: "Agenda una llamada y nosotros implementamos todo por ti, de principio a fin.",
    contacts: "Contactos ilimitados",
    features: [
      "Líneas de WhatsApp personalizadas, sin límite fijo",
      "Todo lo del plan Pro",
      "Lo implementamos nosotros, de punta a punta",
      "Gerente de cuenta dedicado + soporte por WhatsApp",
    ],
    highlight: false,
    ctaLabel: "Agenda una llamada",
    ctaHref: SUPPORT_WHATSAPP_LINK,
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
            <div key={s.title} className="fl-card p-5">
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
          Pago trimestral (cada 3 meses), débito automático — sin sorpresas mes a mes. Un contacto
          activo es cada cliente distinto que te escribe en el mes. Precios de referencia en USD.
        </p>

        <div className="mx-auto mt-8 grid max-w-5xl gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`fl-card flex flex-col p-6 ${plan.highlight ? "border-2 border-accent" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`fl-mono text-xs uppercase tracking-wide ${plan.highlight ? "text-accent" : "text-ink-muted"}`}>
                  {plan.name}
                </p>
                {plan.badge && (
                  <span className="fl-mono rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                    {plan.badge}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <p className="text-3xl font-bold">{plan.price}</p>
                {plan.strikePrice && (
                  <span className="text-base text-ink-faint line-through">{plan.strikePrice}</span>
                )}
              </div>
              {plan.priceSuffix && <p className="text-sm text-ink-muted">{plan.priceSuffix}</p>}
              <p className="mt-1 text-xs text-ink-muted">{plan.billingNote}</p>

              <p className="mt-4 rounded-md bg-background px-3 py-2 text-sm font-medium text-ink">
                {plan.contacts}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                target={plan.ctaHref.startsWith("http") ? "_blank" : undefined}
                rel={plan.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`mt-6 block rounded-md px-4 py-2 text-center font-semibold transition ${
                  plan.highlight
                    ? "bg-accent text-accent-ink hover:bg-accent-hover"
                    : "border border-border text-ink hover:border-border-strong"
                }`}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          ¿Superas los contactos de tu plan?{" "}
          <a href="mailto:voopmarketing@gmail.com" className="text-accent hover:underline">
            Escríbenos
          </a>{" "}
          y lo ajustamos sin cortar tu servicio.
        </p>
      </section>

      <footer className="relative border-t border-border px-6 py-8 text-center text-sm text-ink-muted">
        Funnels Labs — growth partner para coaches, clínicas, ecommerce y SaaS en LATAM.
      </footer>
    </main>
  );
}
