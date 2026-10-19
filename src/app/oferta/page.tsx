import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { HeroChat } from "@/components/landing/HeroChat";
import {
  IconArrow,
  IconBan,
  IconCalc,
  IconCheck,
  IconChat,
  IconClock,
  IconColumns,
  IconGlobe,
  IconHand,
  IconMegaphone,
  IconMoon,
  IconRepeat,
  IconScale,
  IconShare,
  IconShield,
  IconSpark,
  IconStar,
  IconTooth,
  IconWrench,
} from "@/components/landing/Icons";
import { Spotlight } from "@/components/landing/Spotlight";
import { VideoSlot } from "@/components/landing/VideoSlot";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { AGENDA_CALL_URL, AUDIENCE_LINE, BENEFITS, FAQ, PAINS, SEGMENTS, STARTER_POINTS, STEPS, TRUST } from "@/lib/landingContent";
import { LANDING_VIDEOS } from "@/lib/landingVideos";
import { TRIAL_DAYS } from "@/lib/plans";
import "./landing.css";

// Draft of the new offer landing. Not linked from anywhere and kept out of the
// search engines until it replaces the one at "/".
export const metadata: Metadata = {
  title: "Funnels Labs · Que ningún cliente se quede sin respuesta en tu WhatsApp",
  description: "Un asistente que contesta tu WhatsApp, agenda tus citas y te deja el negocio ordenado. Pruébalo 7 días gratis.",
  robots: { index: false, follow: false },
};

const CTA_PRIMARY = `Probar ${TRIAL_DAYS} días gratis`;
const TRIAL_NOTE = `Se cobra a partir del día ${TRIAL_DAYS + 1}. Cancelas cuando quieras.`;

const FEATURES_LINE = ["Contesta todo el día", "Agenda tus citas", "CRM por etapas", "Difusiones por WhatsApp", "Páginas web con IA", "Instagram y Messenger", "Un asistente que te ayuda"];

const PAIN_ICONS = [IconClock, IconMoon, IconRepeat];
const BENEFIT_TAGS = ["Atención", "Sitios web", "Difusiones", "CRM", "Redes", "Asistente"];
const BENEFIT_ICONS = [IconChat, IconGlobe, IconMegaphone, IconColumns, IconShare, IconSpark];
const TRUST_ICONS = [IconShield, IconHand, IconBan];
const SEGMENT_ICONS = [IconTooth, IconSpark, IconScale, IconCalc, IconWrench];
const SEGMENT_TILE = ["lp-tile-lime", "", "lp-tile-violet", "", "lp-tile-light"];

function Cta({ where, className = "", small = false }: { where: string; className?: string; small?: boolean }) {
  return (
    <Link href="/register" data-cta={where} className={`lp-btn ${small ? "lp-btn-sm" : ""} ${className}`}>
      {small ? (
        <>
          <span className="sm:hidden">Probar gratis</span>
          <span className="hidden sm:inline">{CTA_PRIMARY}</span>
        </>
      ) : (
        CTA_PRIMARY
      )}
      <span className="lp-btn-arrow">
        <IconArrow size={small ? 15 : 18} />
      </span>
    </Link>
  );
}

function Star() {
  return <IconStar size={26} className="lp-star" />;
}

export default function OfertaPage() {
  const v = LANDING_VIDEOS;
  return (
    <main className="lp pb-24 md:pb-0">
      {/* Barra superior */}
      <header className="lp-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <a href="#inicio" className="flex items-center gap-2.5">
            <FunnelsLogoMark className="h-7 w-7 flex-none" />
            <span className="whitespace-nowrap text-sm font-extrabold tracking-tight text-white">Funnels Labs</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-ink-muted lg:flex" aria-label="Secciones">
            <a href="#como-funciona" className="transition hover:text-white">Cómo funciona</a>
            <a href="#beneficios" className="transition hover:text-white">Qué incluye</a>
            <a href="#precios" className="transition hover:text-white">Precios</a>
            <a href="#preguntas" className="transition hover:text-white">Preguntas</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden text-sm text-ink-muted transition hover:text-white sm:block">
              Iniciar sesión
            </Link>
            <Cta where="header" small />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="inicio" className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-grid" />

        <div className="relative mx-auto max-w-6xl px-6 pt-12 text-center sm:pt-16">
          <h1 className="lp-h1 mx-auto max-w-6xl">
            Que ningún cliente se quede sin respuesta en tu <span className="lp-lime">WhatsApp</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Un asistente que contesta por ti: da precios, manda fotos y agenda la cita con lo que tú le enseñaste. Si quieres meterte a un chat, entras tú.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Cta where="hero" className="w-full sm:w-auto" />
            <a href="#como-funciona" className="lp-btn-ghost w-full sm:w-auto">
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-faint">{TRIAL_NOTE}</p>
        </div>

        {/* Video 1 + tarjetas flotantes */}
        <div className="relative mx-auto mt-10 max-w-6xl px-6 pb-20 sm:mt-14 lg:pb-[21rem]">
          <div className="lp-arc" />
          <div className="relative">
            <div className="relative z-10 mx-auto max-w-4xl">
              <VideoSlot slot="hero" priority src={v.hero.src} poster={v.hero.poster} title="Mira cómo funciona en menos de un minuto" hint="Video principal (VSL)" />
            </div>

            <div className="relative z-20 mt-6 grid gap-4 sm:grid-cols-2 lg:mt-0 lg:block">
              <div className="lp-bob w-full lg:absolute lg:left-0 lg:top-0 lg:-mt-14 lg:w-[17.5rem]">
                <HeroChat />
              </div>
              <div className="lp-float lp-bob lp-bob-2 hidden p-4 sm:block lg:absolute lg:right-0 lg:top-0 lg:-mt-14 lg:w-[15rem]">
                <div className="flex items-center gap-3">
                  <span className="lp-icon !h-10 !w-10 !rounded-xl">
                    <IconCheck size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Cita agendada</p>
                    <p className="text-[11px] text-white/50">Hace un momento</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Limpieza dental</p>
                  <p className="mt-1 text-sm font-semibold text-white">Jueves · 4:00 p. m.</p>
                  <p className="mt-0.5 text-xs text-white/50">Paciente nuevo</p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
                  <span className="rounded-full bg-white/10 px-2 py-0.5">Interesado</span>
                  <span aria-hidden="true">→</span>
                  <span className="rounded-full bg-[rgba(181,255,43,0.18)] px-2 py-0.5 text-[#c9ff5c]">Agendado</span>
                </div>
              </div>
              <p className="text-center text-[11px] text-ink-faint sm:col-span-2 lg:absolute lg:inset-x-0 lg:top-10 lg:col-auto">Las tarjetas son un ejemplo ilustrativo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Para qué negocios funciona */}
      <section id="funciona-para" className="relative py-14 sm:py-20">
        <p className="lp-eyebrow text-center">Funciona para negocios que viven de citas y consultas</p>
        <div className="lp-marquee mt-8" aria-label={`Hecho para: ${AUDIENCE_LINE.join(", ")}`}>
          {[0, 1].map((n) => (
            <div key={n} className="lp-track" aria-hidden={n === 1}>
              {AUDIENCE_LINE.map((a) => (
                <span key={a} className="flex items-center gap-10">
                  <span className="lp-big">{a}</span>
                  <Star />
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="lp-marquee lp-marquee-rev mt-4" aria-hidden="true">
          {[0, 1].map((n) => (
            <div key={n} className="lp-track">
              {FEATURES_LINE.map((a) => (
                <span key={a} className="flex items-center gap-10">
                  <span className="lp-big lp-outline">{a}</span>
                  <Star />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* El dolor */}
      <section className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <h2 className="lp-h2 lp-rise text-center">¿Te suena?</h2>
        <Spotlight className="mt-10 grid gap-4 md:grid-cols-3">
          {PAINS.map((p, i) => {
            const Icon = PAIN_ICONS[i];
            return (
              <div key={p} className="lp-card lp-rise p-6" style={{ "--i": i } as React.CSSProperties}>
                <span className="lp-icon">
                  <Icon />
                </span>
                <p className="mt-5 text-lg font-medium leading-snug text-white">{p}</p>
              </div>
            );
          })}
        </Spotlight>
        <p className="lp-rise mx-auto mt-10 max-w-2xl text-center text-xl font-semibold leading-snug text-white sm:text-2xl">
          No es que te falten clientes. Es que <span className="lp-lime">muchos se pierden en el WhatsApp.</span>
        </p>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Cómo funciona</p>
        <h2 className="lp-h2 lp-rise mt-3 text-center">Así de simple es empezar</h2>
        <Spotlight className="lp-steps mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="lp-card lp-rise p-7 text-center" style={{ "--i": i } as React.CSSProperties}>
              <span className="lp-num">{s.n}</span>
              <p className="mt-5 text-xl font-bold tracking-tight text-white">{s.title}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </div>
          ))}
        </Spotlight>
        <div className="lp-rise mx-auto mt-14 max-w-4xl">
          <VideoSlot slot="how" src={v.how.src} poster={v.how.poster} title="Mira la plataforma por dentro" caption="La plataforma, en pantalla" hint="Video 2 · la plataforma" />
        </div>
        <div className="mt-10 text-center">
          <Cta where="how" />
        </div>
      </section>

      {/* Qué incluye */}
      <section id="beneficios" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Qué incluye</p>
        <h2 className="lp-h2 lp-rise mx-auto mt-3 max-w-3xl text-center">Y no es solo contestar WhatsApp</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-muted">También te deja el negocio ordenado y trayendo clientes nuevos.</p>

        <div className="lp-stack mt-14 space-y-8 md:space-y-10">
          {BENEFITS.map((b, i) => {
            const Icon = BENEFIT_ICONS[i];
            const alt = i % 2 === 1;
            return (
              <article key={b.title} data-alt={alt ? 1 : 0} className="lp-panel p-5 sm:p-8 lg:p-10" style={{ "--i": i } as React.CSSProperties}>
                <div className={`grid items-center gap-8 lg:gap-12 ${alt ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)]" : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.45fr)]"}`}>
                  <div className={alt ? "lg:order-2" : ""}>
                    <div className="flex items-center gap-3">
                      <span className="lp-icon">
                        <Icon />
                      </span>
                      <span className="lp-eyebrow">{BENEFIT_TAGS[i]}</span>
                    </div>
                    <h3 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{b.title}</h3>
                    <p className="mt-4 text-base leading-relaxed text-ink-muted">{b.text}</p>
                    <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
                      <span className="font-semibold text-accent">Por ejemplo: </span>
                      <span className="text-ink-muted">{b.example}</span>
                    </p>
                  </div>
                  <div className={`lp-shot ${alt ? "lg:order-1" : ""}`}>
                    {/* Marco de navegador: la plataforma se ve completa, sin recortes. */}
                    <div className="lp-browser">
                      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3 py-2" aria-hidden="true">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                        <span className="ml-3 truncate rounded-md bg-black/40 px-3 py-0.5 text-[11px] text-ink-faint">agente.funnelslabs.app</span>
                      </div>
                      {/* Imagen ya ajustada y comprimida (1800 px), no necesita el optimizador. */}
                      <Image src={b.image} alt={b.alt} width={b.width} height={b.height} unoptimized loading="lazy" sizes="(min-width:1024px) 60vw, 100vw" className="block h-auto w-full" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-ink-faint">Capturas de la plataforma con un negocio de ejemplo.</p>
      </section>

      {/* Para quién */}
      <section className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Para quién es</p>
        <h2 className="lp-h2 lp-rise mx-auto mt-3 max-w-3xl text-center">Si vives de citas y consultas, esto es para ti</h2>
        <Spotlight className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((s, i) => {
            const Icon = SEGMENT_ICONS[i];
            const tile = SEGMENT_TILE[i];
            const big = i === 0;
            const light = tile === "lp-tile-light" || tile === "lp-tile-lime";
            return (
              <div
                key={s.title}
                className={`lp-card lp-rise flex flex-col justify-between p-6 ${tile} ${big ? "sm:col-span-2 lg:row-span-2 lg:p-8" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${light ? "bg-black/10 text-black" : "border border-white/15 bg-white/[0.06] text-white"}`}
                >
                  <Icon />
                </span>
                {big && (
                  <div className="mt-8 hidden max-w-xs flex-col gap-2 text-[13px] font-medium sm:flex" aria-hidden="true">
                    <p className="self-start rounded-2xl rounded-tl-md bg-black/80 px-3 py-2 text-white">¿Cuánto cuesta la limpieza?</p>
                    <p className="self-end rounded-2xl rounded-tr-md bg-white/70 px-3 py-2 text-black">$120.000. ¿Te agendo esta semana?</p>
                  </div>
                )}
                <div className={big ? "mt-10 lg:mt-12" : "mt-10"}>
                  <p className={`font-extrabold tracking-tight ${big ? "text-3xl sm:text-4xl" : "text-xl"} ${light ? "" : "text-white"}`}>{s.title}</p>
                  <p className={`mt-3 text-sm leading-relaxed ${light ? "text-black/70" : "text-ink-muted"} ${big ? "sm:text-base" : ""}`}>{s.text}</p>
                </div>
              </div>
            );
          })}
        </Spotlight>
      </section>

      {/* Confianza */}
      <section className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Sin sorpresas</p>
        <h2 className="lp-h2 lp-rise mt-3 text-center">Tú tienes el control</h2>
        <Spotlight className="mt-12 grid gap-4 md:grid-cols-3">
          {TRUST.map((t, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <div key={t.title} className="lp-card lp-rise p-6" style={{ "--i": i } as React.CSSProperties}>
                <span className="lp-icon">
                  <Icon />
                </span>
                <p className="mt-5 text-lg font-bold text-white">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.text}</p>
              </div>
            );
          })}
        </Spotlight>
      </section>

      {/* Precio */}
      <section id="precios" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Precios</p>
        <h2 className="lp-h2 lp-rise mt-3 text-center">Empieza gratis y decide después</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-ink-muted">Precios de referencia en USD. Pago mensual con débito automático; cancelas cuando quieras.</p>
        <Spotlight className="mx-auto mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          <div className="lp-hot">
            <div className="lp-hot-in flex h-full flex-col p-7">
              <div className="flex items-center justify-between">
                <p className="lp-eyebrow">Starter</p>
                <span className="rounded-full bg-[rgba(181,255,43,0.15)] px-3 py-1 text-[11px] font-semibold text-[#c9ff5c]">Para empezar</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-5xl font-extrabold tracking-tight text-white">$97</p>
                <p className="text-base font-semibold text-ink-muted">USD / mes</p>
              </div>
              <p className="mt-2 text-sm font-medium text-white">
                {TRIAL_DAYS} días gratis. {TRIAL_NOTE}
              </p>
              <ul className="lp-dotlist mt-6 space-y-2.5 text-sm text-ink-muted">
                {STARTER_POINTS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Cta where="precio" className="mt-8 w-full" />
            </div>
          </div>
          <div className="lp-card lp-rise flex flex-col p-7" style={{ "--i": 1 } as React.CSSProperties}>
            <p className="lp-eyebrow !text-ink-muted">Pro</p>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-extrabold tracking-tight text-white">$297</p>
              <p className="text-base font-semibold text-ink-muted">USD / mes</p>
            </div>
            <p className="mt-2 text-sm text-ink-muted">Para varias sedes o mucho volumen de mensajes.</p>
            <ul className="lp-dotlist mt-6 space-y-2.5 text-sm text-ink-muted">
              <li>Todo lo del plan Starter</li>
              <li>Hasta 1.200 clientes atendidos por la IA al mes</li>
              <li>Hasta 3 líneas de WhatsApp (sedes, marcas o vendedores)</li>
              <li>10.000 envíos masivos al mes por línea</li>
              <li>Hasta 10 personas en tu equipo</li>
            </ul>
            <div className="mt-auto pt-8">
              <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" data-cta="pro" className="lp-btn-ghost w-full">
                Quiero el plan Pro
              </a>
            </div>
          </div>
          <div className="lp-card lp-rise flex flex-col p-7" style={{ "--i": 2 } as React.CSSProperties}>
            <p className="lp-eyebrow !text-ink-muted">Consultoría</p>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-4xl font-extrabold tracking-tight text-white">$597+</p>
              <p className="text-base font-semibold text-ink-muted">USD / mes</p>
            </div>
            <p className="mt-2 text-sm text-ink-muted">Nosotros lo hacemos todo por ti, de principio a fin.</p>
            <ul className="lp-dotlist mt-6 space-y-2.5 text-sm text-ink-muted">
              <li>Todo lo del plan Pro, con cupo y líneas a tu medida</li>
              <li>Desarrollo a tu medida: lo que tu negocio necesite</li>
              <li>Lo implementamos nosotros de punta a punta</li>
              <li>Un gerente de cuenta y soporte por WhatsApp</li>
            </ul>
            <div className="mt-auto pt-8">
              <a href={AGENDA_CALL_URL} target="_blank" rel="noopener noreferrer" data-cta="consultoria" className="lp-btn-ghost w-full">
                Agendar una llamada
              </a>
            </div>
          </div>
        </Spotlight>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className="relative mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="lp-eyebrow text-center">Preguntas</p>
        <h2 className="lp-h2 lp-rise mt-3 text-center">Lo que casi todos preguntan</h2>
        <div className="lp-faq mt-10 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-white">
                {item.q}
                <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-white/15 text-lg leading-none text-accent transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24 pt-10">
        <div className="lp-close lp-rise px-6 py-16 text-center sm:py-20">
          <h2 className="lp-h2 mx-auto max-w-2xl">
            Pruébalo {TRIAL_DAYS} días. <span className="lp-lime">Si no te sirve, cancelas y listo.</span>
          </h2>
          <div className="mt-9 flex flex-col items-center gap-4">
            <Cta where="cierre" className="w-full sm:w-auto" />
            <p className="text-sm text-ink-muted">{TRIAL_NOTE}</p>
            <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" className="mt-1 text-sm font-semibold text-accent hover:underline">
              ¿Prefieres hablar con una persona? Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/10 px-6 py-8 text-center text-sm text-ink-faint">Funnels Labs · Asistentes de IA para negocios en Latinoamérica</footer>

      {/* Botón fijo en el celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[rgba(10,10,10,0.92)] p-3 backdrop-blur md:hidden">
        <Cta where="fijo" className="w-full" />
      </div>
    </main>
  );
}
