import type { Section } from "@/lib/websiteContentV2";
import type { Angle, Niche } from "./types";

export type Blueprint = {
  key: string;
  /** Shown on the card. */
  name: string;
  /** The conversion idea behind the arrangement, in one line. */
  strategy: string;
  /** Small mono counters ("02 / 08") before each section label. */
  counters?: boolean;
  build: (n: Niche, a: Angle, business: string) => Section[];
};

const fill = (text: string, business: string) => text.replaceAll("{negocio}", business);

const hero = (a: Angle, business: string, variant: "split" | "centered" | "giant" | "wordmark", showLeadForm = false): Section => ({
  type: "hero",
  variant,
  eyebrow: fill(a.eyebrow, business),
  heading: a.heading,
  highlight: a.highlight,
  subheading: fill(a.sub, business),
  chips: a.chips,
  showLeadForm,
  ctaLabel: a.cta,
  secondaryCtaLabel: showLeadForm ? null : a.secondary,
  badge: null,
  productId: null,
});

const trust = (n: Niche, count = 3, variant: "row" | "ticker" = "row"): Section => ({ type: "trustBar", variant, items: n.trust.slice(0, count) });
const features = (n: Niche, variant: "cards" | "icons" | "list" | "bento" | "numbered", count = 6): Section => ({
  type: "features",
  variant,
  kicker: n.servicesKicker,
  heading: n.servicesHeading,
  intro: null,
  items: n.services.slice(0, count),
});
const steps = (n: Niche, variant: "row" | "timeline" | "big" = "row"): Section => ({ type: "steps", variant, kicker: n.stepsKicker, heading: n.stepsHeading, items: n.steps });
const faq = (n: Niche, count = 4, variant: "list" | "split" = "list"): Section => ({ type: "objections", variant, kicker: "Preguntas frecuentes", heading: n.faqHeading, items: n.faq.slice(0, count) });
const host = (n: Niche, business: string): Section => ({
  type: "host",
  kicker: n.host.kicker,
  heading: n.host.heading,
  name: business,
  role: n.host.role,
  body: fill(n.host.body, business),
});
const comparison = (n: Niche, business: string): Section => ({
  type: "comparison",
  heading: n.comparison.heading,
  usLabel: business,
  othersLabel: n.comparison.othersLabel,
  rows: n.comparison.rows,
});
const promo = (n: Niche, tone: "dark" | "accent" | "soft"): Section => ({
  type: "promo",
  tone,
  kicker: n.promo.kicker,
  heading: n.promo.heading,
  body: n.promo.body,
  ctaLabel: n.promo.cta,
});
const cta = (n: Niche, variant: "band" | "giant" = "band"): Section => ({ type: "cta", variant, heading: n.cta.heading, body: n.cta.body, ctaLabel: n.cta.label });
const form = (n: Niche): Section => ({ type: "leadForm", kicker: n.form.kicker, heading: n.form.heading, body: n.form.body, buttonLabel: n.form.button });
const marquee = (n: Niche): Section => ({ type: "marquee", lines: n.marquee });

// Twelve arrangements of the same pieces. Each one ends in a contact form and repeats its main
// button along the way; they differ in what comes first (the offer, the problem, the proof, the
// process…), because different visitors need different things before they write.
export const BLUEPRINTS: Blueprint[] = [
  {
    key: "cita-directa",
    name: "Cita directa",
    strategy: "Promesa clara, servicios y formulario: para quien ya sabe lo que busca.",
    build: (n, a, b) => [hero(a, b, "split"), trust(n), features(n, "cards"), steps(n), host(n, b), faq(n), form(n)],
  },
  {
    key: "formulario-en-portada",
    name: "Formulario en portada",
    strategy: "El formulario está desde el primer vistazo: menos pasos para escribirte.",
    build: (n, a, b) => [hero(a, b, "split", true), trust(n, 4, "ticker"), features(n, "bento", 5), steps(n, "timeline"), faq(n, 4, "split"), cta(n)],
  },
  {
    key: "problema-y-solucion",
    name: "Problema y solución",
    strategy: "Empieza por lo que le duele al cliente y lo compara con hacerlo por su cuenta.",
    build: (n, a, b) => [hero(a, b, "centered"), comparison(n, b), features(n, "numbered", 5), steps(n, "big"), faq(n), form(n)],
  },
  {
    key: "confianza-primero",
    name: "Confianza primero",
    strategy: "Presenta a quien atiende y las garantías antes de pedir el contacto.",
    build: (n, a, b) => [hero(a, b, "split"), host(n, b), trust(n, 4), features(n, "icons"), faq(n, 5, "split"), cta(n)],
  },
  {
    key: "titular-gigante",
    name: "Titular gigante",
    strategy: "Un mensaje que se lee de lejos y un solo camino: escribirte.",
    build: (n, a, b) => [hero(a, b, "giant"), marquee(n), features(n, "list"), steps(n, "timeline"), cta(n, "giant"), faq(n), form(n)],
  },
  {
    key: "paso-a-paso",
    counters: true,
    name: "Paso a paso",
    strategy: "Quita el miedo a empezar mostrando exactamente qué pasa después de escribir.",
    build: (n, a, b) => [hero(a, b, "centered"), steps(n, "big"), features(n, "bento", 6), comparison(n, b), faq(n), form(n)],
  },
  {
    key: "primer-paso",
    counters: true,
    name: "Primer paso sin compromiso",
    strategy: "Una franja que invita a una primera conversación, sin descuentos inventados.",
    build: (n, a, b) => [hero(a, b, "wordmark"), trust(n), promo(n, "accent"), features(n, "cards"), steps(n), faq(n), form(n)],
  },
  {
    key: "servicios-primero",
    counters: true,
    name: "Servicios primero",
    strategy: "Muestra todo lo que haces enseguida: para quien compara opciones.",
    build: (n, a, b) => [hero(a, b, "centered"), features(n, "bento", 6), promo(n, "dark"), steps(n, "timeline"), host(n, b), form(n)],
  },
  {
    key: "preguntas-primero",
    name: "Preguntas primero",
    strategy: "Responde las dudas antes que nada: ideal cuando el cliente duda de contratar.",
    build: (n, a, b) => [hero(a, b, "split"), faq(n, 6, "split"), features(n, "numbered", 5), steps(n), trust(n, 3, "ticker"), cta(n, "giant")],
  },
  {
    key: "minimal",
    counters: true,
    name: "Minimal y directo",
    strategy: "Pocas secciones y mucho aire: carga rápido y va al grano.",
    build: (n, a, b) => [hero(a, b, "wordmark"), features(n, "list", 4), steps(n, "big"), form(n)],
  },
  {
    key: "doble-llamado",
    name: "Doble llamado a la acción",
    strategy: "Un botón a mitad de la página y otro al final: para quien se decide leyendo.",
    build: (n, a, b) => [hero(a, b, "split"), features(n, "icons"), promo(n, "soft"), comparison(n, b), steps(n, "big"), faq(n), cta(n), form(n)],
  },
  {
    key: "garantias-y-proceso",
    counters: true,
    name: "Garantías y proceso",
    strategy: "Pone el proceso y las garantías al frente para bajar la sensación de riesgo.",
    build: (n, a, b) => [hero(a, b, "centered"), trust(n, 4), steps(n, "timeline"), features(n, "numbered", 5), host(n, b), faq(n, 5, "split"), cta(n), form(n)],
  },
];
