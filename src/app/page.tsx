import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { STARTER_FEATURES, TRIAL_DAYS } from "@/lib/plans";

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
    title: "Inmobiliarias",
    text: "Agenda visitas a propiedades, responde disponibilidad y precios al instante, y filtra compradores serios antes de que tu asesor pierda tiempo.",
  },
];

const FAQ = [
  {
    q: "¿Cuántos contactos puedo tener?",
    a: "Ilimitados. Tu CRM guarda tus contactos y conversaciones (con una política de uso justo de 20.000 contactos en Starter y 50.000 en Pro, que casi ningún negocio alcanza). Lo que el plan cuenta es cuántos clientes distintos atiende tu agente de IA en el mes (400 en Starter), y a cada uno le responde todas las veces que haga falta.",
  },
  {
    q: "¿Cómo funciona la prueba gratis?",
    a: `El plan Starter tiene ${TRIAL_DAYS} días gratis. Creas tu cuenta, registras tu tarjeta en Mercado Pago y empiezas de inmediato; no se cobra nada hasta que termina la prueba y puedes cancelar antes cuando quieras. Los planes Pro y Consultoría se activan con nuestro equipo.`,
  },
  {
    q: "¿Cuántos mensajes masivos puedo enviar?",
    a: "Starter incluye 2.000 envíos de difusión al mes y Pro 10.000, por línea de WhatsApp. Se renuevan el día 1 de cada mes.",
  },
  {
    q: "¿Qué pasa si llego al límite del mes?",
    a: "Te avisamos al 80%. Si llegas al 100%, tus clientes actuales siguen siendo atendidos y puedes responder a mano a los nuevos, o agregar un paquete de clientes desde tu panel y la IA vuelve a responder al instante.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Cancelas cuando quieras y tu acceso sigue activo hasta el final del periodo que ya pagaste — sin penalización.",
  },
  {
    q: "¿Qué pasa con los datos de mis clientes?",
    a: "Nunca usamos tus conversaciones para entrenar modelos de IA ni las vendemos a terceros. Solo se usan para que tu agente responda y para tu propio panel de métricas.",
  },
  {
    q: "¿Qué implica la llamada para conectar mi WhatsApp?",
    a: "Dura 30-45 minutos. Te guiamos paso a paso para conectar tu número real a la API oficial de Meta — nada más.",
  },
  {
    q: "¿Pierdo el control de las respuestas?",
    a: "No. Puedes pausar la IA en cualquier conversación y responder tú mismo cuando quieras — el agente nunca actúa a tus espaldas.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$97",
    priceSuffix: "USD / mes",
    billingNote: `${TRIAL_DAYS} días gratis. Luego se cobra automáticamente cada mes; cancelas cuando quieras.`,
    contacts: "400 clientes atendidos por IA al mes",
    features: STARTER_FEATURES.filter((f) => !f.startsWith("400 ")),
    highlight: true,
    ctaLabel: `Probar ${TRIAL_DAYS} días gratis`,
    ctaHref: "/register",
  },
  {
    name: "Pro",
    price: "$297",
    priceSuffix: "USD / mes",
    billingNote: "Se cobra automáticamente cada mes. Cancelas cuando quieras.",
    contacts: "1.200 clientes atendidos por IA al mes",
    features: [
      "Todo lo del plan Starter",
      "Hasta 3 líneas de WhatsApp (sedes, marcas o vendedores)",
      "10.000 envíos masivos al mes por línea",
      "Hasta 10 personas de tu equipo",
      "Para negocios con anuncios y volumen alto de mensajes",
      "Acompañamiento prioritario por WhatsApp",
    ],
    highlight: false,
    ctaLabel: "Quiero el plan Pro",
    ctaHref: SUPPORT_WHATSAPP_LINK,
  },
  {
    name: "Consultoría",
    price: "$597+",
    priceSuffix: "USD / mes",
    billingNote: "Desde $597 USD al mes, más implementación. Agenda una llamada y nosotros lo hacemos todo por ti, de principio a fin.",
    contacts: "Clientes atendidos por IA y líneas a la medida de tu volumen",
    features: [
      "Todo lo del plan Pro, con cupo de IA y líneas a tu medida",
      "Desarrollo a medida: lo que tu negocio necesite, hecho para ti",
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
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink">
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Crear mi cuenta
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
          Pago mensual con débito automático; cancelas cuando quieras. Tu CRM guarda
          contactos ilimitados; el cupo del plan es cuántos clientes distintos atiende tu agente de IA
          cada mes, con todas las respuestas que necesiten. Precios de referencia en USD.
        </p>

        <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`fl-card flex flex-col p-6 ${plan.highlight ? "border-2 border-accent" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`fl-mono text-xs uppercase tracking-wide ${plan.highlight ? "text-accent" : "text-ink-muted"}`}>
                  {plan.name}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <p className="text-3xl font-bold">{plan.price}</p>
                {plan.priceSuffix && <p className="text-base font-semibold text-ink-muted">{plan.priceSuffix}</p>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{plan.billingNote}</p>

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
          ¿Tu negocio atiende más clientes? Agrega paquetes desde +100 clientes atendidos por IA por
          $89.000 COP (hasta +1.000) desde tu panel y se activan al instante.{" "}
          <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Escríbenos
          </a>{" "}
          si necesitas algo a tu medida.
        </p>
      </section>

      <section className="relative mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Preguntas frecuentes
        </h2>
        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="border-t border-border pt-3">
              <p className="font-semibold">{item.q}</p>
              <p className="mt-1 text-sm text-ink-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-border px-6 py-8 text-center text-sm text-ink-muted">
        Funnels Labs — growth partner para coaches, clínicas, ecommerce y SaaS en LATAM.
      </footer>
    </main>
  );
}
