import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { VideoSlot } from "@/components/landing/VideoSlot";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { LANDING_VIDEOS } from "@/lib/landingVideos";
import { AGENDA_CALL_URL, AUDIENCE_LINE, BENEFITS, FAQ, PAINS, SEGMENTS, STARTER_POINTS, STEPS, TRUST } from "@/lib/landingContent";
import { TRIAL_DAYS } from "@/lib/plans";

// Draft of the new offer landing. Not linked from anywhere and kept out of the
// search engines until it replaces the one at "/".
export const metadata: Metadata = {
  title: "Funnels Labs · Que ningún cliente se quede sin respuesta en tu WhatsApp",
  description: "Un asistente que contesta tu WhatsApp, agenda tus citas y te deja el negocio ordenado. Pruébalo 7 días gratis.",
  robots: { index: false, follow: false },
};

const CTA_PRIMARY = `Probar ${TRIAL_DAYS} días gratis`;
const TRIAL_NOTE = `Se cobra a partir del día ${TRIAL_DAYS + 1}. Cancelas cuando quieras.`;

function Cta({ where, className = "" }: { where: string; className?: string }) {
  return (
    <Link
      href="/register"
      data-cta={where}
      className={`inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-accent-ink shadow-lg transition hover:bg-accent-hover ${className}`}
    >
      {CTA_PRIMARY}
    </Link>
  );
}

/** A made-up conversation, drawn with HTML: shows what the client sees while the videos are not ready. */
function ChatMock() {
  const rows: [("in" | "out"), string][] = [
    ["in", "Hola, ¿cuánto cuesta la limpieza dental?"],
    ["out", "¡Hola! La limpieza dental cuesta $120.000 y dura unos 45 minutos. ¿Te agendo para esta semana?"],
    ["in", "Sí, el jueves en la tarde"],
    ["out", "Listo, quedaste el jueves a las 4:00 p. m. Te esperamos."],
  ];
  return (
    <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-border-strong bg-surface p-3 shadow-2xl" aria-label="Ejemplo de conversación de WhatsApp">
      <div className="rounded-[1.5rem] bg-[#0b141a] p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25d366] text-xs font-bold text-white">CS</span>
          <div>
            <p className="text-sm font-semibold text-white">Clínica Sonrisa</p>
            <p className="text-[11px] text-white/60">10:42 p. m.</p>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map(([dir, text], i) => (
            <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug ${dir === "in" ? "bg-[#202c33] text-white" : "ml-auto bg-[#005c4b] text-white"}`}>
              {text}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-faint">Ejemplo ilustrativo</p>
    </div>
  );
}

export default function OfertaPage() {
  const v = LANDING_VIDEOS;
  return (
    <main className="relative overflow-hidden pb-24 md:pb-0">
      <div className="fl-grid-bg pointer-events-none absolute inset-0 h-[44rem]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden text-sm text-ink-muted hover:text-ink sm:block">
            Iniciar sesión
          </Link>
          <Cta where="header" className="!px-4 !py-2 !text-sm" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr]">
        <div className="text-center lg:text-left">
          <p className="fl-mono mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Para negocios que viven de citas y consultas</p>
          <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">Que ningún cliente se quede sin respuesta en tu WhatsApp</h1>
          <p className="mt-5 text-lg text-ink-muted">
            Un asistente que contesta por ti: da precios, manda fotos y agenda la cita con lo que tú le enseñaste. Si quieres meterte a un chat, entras tú.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
            <Cta where="hero" className="w-full sm:w-auto" />
            <p className="text-sm text-ink-muted">{TRIAL_NOTE}</p>
            <a href="#como-funciona" className="text-sm font-semibold text-accent hover:underline">
              Ver cómo funciona
            </a>
          </div>
        </div>
        <div>
          {v.hero.src ? (
            <VideoSlot slot="hero" src={v.hero.src} poster={v.hero.poster} title="Mira cómo funciona en menos de un minuto" caption="Menos de un minuto" />
          ) : (
            <ChatMock />
          )}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="font-semibold text-ink">Hecho para:</span>
          {AUDIENCE_LINE.map((a, i) => (
            <span key={a}>
              {a}
              {i < AUDIENCE_LINE.length - 1 && <span className="ml-3 text-ink-faint">·</span>}
            </span>
          ))}
        </p>
      </section>

      {/* El dolor */}
      <section className="relative mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">¿Te suena?</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {PAINS.map((p) => (
            <li key={p} className="fl-card p-5 text-base leading-relaxed">
              {p}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-8 max-w-2xl text-center text-lg text-ink-muted">
          No es que te falten clientes. Es que muchos se pierden en el WhatsApp.
        </p>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="relative mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-center text-3xl font-bold">Así de simple es empezar</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="fl-card p-6">
              <div className="fl-mono flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{s.n}</div>
              <p className="mt-4 text-lg font-semibold">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
        {v.how.src && (
          <div className="mx-auto mt-10 max-w-3xl">
            <VideoSlot slot="how" src={v.how.src} poster={v.how.poster} title="Mira la plataforma por dentro" caption="La plataforma, en pantalla" />
          </div>
        )}
        <div className="mt-8 text-center">
          <Cta where="how" />
        </div>
      </section>

      {/* Más que un chatbot */}
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Y no es solo contestar WhatsApp</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-ink-muted">También te deja el negocio ordenado y trayendo clientes nuevos.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <article key={b.title} className="fl-card flex flex-col overflow-hidden">
              {b.image && (
                <div className="relative aspect-[3/2] overflow-hidden border-b border-border bg-surface-2">
                  {/* Already sized and compressed (1400 px, about 100 KB), so the image optimizer is not needed. */}
                  <Image src={b.image} alt={b.alt ?? ""} fill unoptimized sizes="(min-width:1024px) 30vw, (min-width:768px) 45vw, 100vw" className="object-cover object-top" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold leading-snug">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.text}</p>
                <p className="mt-auto pt-4 text-sm">
                  <span className="font-semibold text-accent">Por ejemplo: </span>
                  <span className="text-ink-muted">{b.example}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-faint">Las capturas son de un negocio de ejemplo.</p>
      </section>

      {/* Para quién */}
      <section className="relative mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-center text-3xl font-bold">Si vives de citas y consultas, esto es para ti</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((s) => (
            <div key={s.title} className="fl-card p-5">
              <p className="font-semibold">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Confianza */}
      <section className="relative mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Tus clientes y tus datos siguen siendo tuyos</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TRUST.map((t) => (
            <div key={t.title} className="fl-card p-5">
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.text}</p>
            </div>
          ))}
        </div>
        {v.trust.src && (
          <div className="mx-auto mt-10 max-w-3xl">
            <VideoSlot slot="trust" src={v.trust.src} poster={v.trust.poster} title="Antes de decidir, mira esto" caption="Si todavía tienes dudas" />
          </div>
        )}
      </section>

      {/* Precio */}
      <section id="precios" className="relative mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-center text-3xl font-bold">Empieza gratis y decide después</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-ink-muted">Precios de referencia en USD. Pago mensual con débito automático; cancelas cuando quieras.</p>
        <div className="mx-auto mt-8 grid gap-6 md:grid-cols-3">
          <div className="fl-card flex flex-col border-2 border-accent p-6">
            <p className="fl-mono text-xs uppercase tracking-wide text-accent">Starter</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-4xl font-bold">$97</p>
              <p className="text-base font-semibold text-ink-muted">USD / mes</p>
            </div>
            <p className="mt-1 text-sm font-medium text-ink">{TRIAL_DAYS} días gratis. {TRIAL_NOTE}</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-muted">
              {STARTER_POINTS.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-accent">●</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Cta where="precio" className="mt-6" />
          </div>
          <div className="fl-card flex flex-col p-6">
            <p className="fl-mono text-xs uppercase tracking-wide text-ink-muted">Pro</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold">$297</p>
              <p className="text-base font-semibold text-ink-muted">USD / mes</p>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Para varias sedes o mucho volumen de mensajes.</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-muted">
              <li>Todo lo del plan Starter</li>
              <li>Hasta 1.200 clientes atendidos por la IA al mes</li>
              <li>Hasta 3 líneas de WhatsApp (sedes, marcas o vendedores)</li>
              <li>10.000 envíos masivos al mes por línea</li>
              <li>Hasta 10 personas en tu equipo</li>
            </ul>
            <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" data-cta="pro" className="mt-6 block rounded-lg border border-border px-4 py-3 text-center font-semibold transition hover:border-border-strong">
              Quiero el plan Pro
            </a>
          </div>
          <div className="fl-card flex flex-col p-6">
            <p className="fl-mono text-xs uppercase tracking-wide text-ink-muted">Consultoría</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold">$597+</p>
              <p className="text-base font-semibold text-ink-muted">USD / mes</p>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Nosotros lo hacemos todo por ti, de principio a fin.</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-muted">
              <li>Todo lo del plan Pro, con cupo y líneas a tu medida</li>
              <li>Desarrollo a tu medida: lo que tu negocio necesite</li>
              <li>Lo implementamos nosotros de punta a punta</li>
              <li>Un gerente de cuenta y soporte por WhatsApp</li>
            </ul>
            <a href={AGENDA_CALL_URL} target="_blank" rel="noopener noreferrer" data-cta="consultoria" className="mt-6 block rounded-lg border border-border px-4 py-3 text-center font-semibold transition hover:border-border-strong">
              Agendar una llamada
            </a>
          </div>
        </div>
      </section>

      {/* Preguntas */}
      <section className="relative mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Lo que casi todos preguntan</h2>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-xl text-accent transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="relative mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold">Pruébalo {TRIAL_DAYS} días. Si no te sirve, cancelas y listo.</h2>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Cta where="cierre" className="w-full sm:w-auto" />
          <p className="text-sm text-ink-muted">{TRIAL_NOTE}</p>
          <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" className="mt-2 text-sm font-semibold text-accent hover:underline">
            ¿Prefieres hablar con una persona? Escríbenos por WhatsApp
          </a>
        </div>
      </section>

      <footer className="relative border-t border-border px-6 py-8 text-center text-sm text-ink-muted">Funnels Labs · Asistentes de IA para negocios en Latinoamérica</footer>

      {/* Botón fijo en el celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur md:hidden">
        <Cta where="fijo" className="w-full" />
      </div>
    </main>
  );
}
