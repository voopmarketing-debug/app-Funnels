import type { Section } from "@/lib/websiteContentV2";
import type { Angle, Niche } from "./types";

export type Blueprint = {
  key: string;
  /** Shown on the card. */
  name: string;
  /** The conversion idea behind the arrangement, in one line. */
  strategy: string;
  /** Section types in order, for the card's mini preview. */
  shape: Section["type"][];
  build: (n: Niche, a: Angle, business: string) => Section[];
};

const fill = (text: string, business: string) => text.replaceAll("{negocio}", business);

const hero = (a: Angle, business: string, variant: "split" | "centered" | "giant", showLeadForm = false): Section => ({
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

const trust = (n: Niche, count = 3): Section => ({ type: "trustBar", items: n.trust.slice(0, count) });
const features = (n: Niche, variant: "cards" | "icons" | "list", count = 6): Section => ({
  type: "features",
  variant,
  kicker: n.servicesKicker,
  heading: n.servicesHeading,
  intro: null,
  items: n.services.slice(0, count),
});
const steps = (n: Niche): Section => ({ type: "steps", kicker: n.stepsKicker, heading: n.stepsHeading, items: n.steps });
const faq = (n: Niche, count = 4): Section => ({ type: "objections", kicker: "Preguntas frecuentes", heading: n.faqHeading, items: n.faq.slice(0, count) });
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
const cta = (n: Niche): Section => ({ type: "cta", heading: n.cta.heading, body: n.cta.body, ctaLabel: n.cta.label });
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
    shape: ["hero", "trustBar", "features", "steps", "host", "objections", "leadForm"],
    build: (n, a, b) => [hero(a, b, "split"), trust(n), features(n, "cards"), steps(n), host(n, b), faq(n), form(n)],
  },
  {
    key: "formulario-en-portada",
    name: "Formulario en portada",
    strategy: "El formulario está desde el primer vistazo: menos pasos para escribirte.",
    shape: ["hero", "trustBar", "features", "steps", "objections", "cta"],
    build: (n, a, b) => [hero(a, b, "split", true), trust(n), features(n, "icons"), steps(n), faq(n), cta(n)],
  },
  {
    key: "problema-y-solucion",
    name: "Problema y solución",
    strategy: "Empieza por lo que le duele al cliente y lo compara con hacerlo por su cuenta.",
    shape: ["hero", "comparison", "features", "steps", "objections", "leadForm"],
    build: (n, a, b) => [hero(a, b, "centered"), comparison(n, b), features(n, "list"), steps(n), faq(n), form(n)],
  },
  {
    key: "confianza-primero",
    name: "Confianza primero",
    strategy: "Presenta a quien atiende y las garantías antes de pedir el contacto.",
    shape: ["hero", "host", "trustBar", "features", "objections", "cta"],
    build: (n, a, b) => [hero(a, b, "split"), host(n, b), trust(n, 4), features(n, "cards"), faq(n, 5), cta(n)],
  },
  {
    key: "titular-gigante",
    name: "Titular gigante",
    strategy: "Un mensaje que se lee de lejos y un solo camino: escribirte.",
    shape: ["hero", "marquee", "features", "steps", "cta", "objections", "leadForm"],
    build: (n, a, b) => [hero(a, b, "giant"), marquee(n), features(n, "list"), steps(n), cta(n), faq(n), form(n)],
  },
  {
    key: "paso-a-paso",
    name: "Paso a paso",
    strategy: "Quita el miedo a empezar mostrando exactamente qué pasa después de escribir.",
    shape: ["hero", "steps", "features", "comparison", "objections", "leadForm"],
    build: (n, a, b) => [hero(a, b, "centered"), steps(n), features(n, "icons"), comparison(n, b), faq(n), form(n)],
  },
  {
    key: "primer-paso",
    name: "Primer paso sin compromiso",
    strategy: "Una franja que invita a una primera conversación, sin descuentos inventados.",
    shape: ["hero", "trustBar", "promo", "features", "steps", "objections", "leadForm"],
    build: (n, a, b) => [hero(a, b, "split"), trust(n), promo(n, "accent"), features(n, "cards"), steps(n), faq(n), form(n)],
  },
  {
    key: "servicios-primero",
    name: "Servicios primero",
    strategy: "Muestra todo lo que haces enseguida: para quien compara opciones.",
    shape: ["hero", "features", "promo", "steps", "host", "leadForm"],
    build: (n, a, b) => [hero(a, b, "centered"), features(n, "cards", 8), promo(n, "dark"), steps(n), host(n, b), form(n)],
  },
  {
    key: "preguntas-primero",
    name: "Preguntas primero",
    strategy: "Responde las dudas antes que nada: ideal cuando el cliente duda de contratar.",
    shape: ["hero", "objections", "features", "steps", "trustBar", "cta"],
    build: (n, a, b) => [hero(a, b, "split"), faq(n, 6), features(n, "icons"), steps(n), trust(n), cta(n)],
  },
  {
    key: "minimal",
    name: "Minimal y directo",
    strategy: "Pocas secciones y mucho aire: carga rápido y va al grano.",
    shape: ["hero", "features", "steps", "leadForm"],
    build: (n, a, b) => [hero(a, b, "centered"), features(n, "list", 4), steps(n), form(n)],
  },
  {
    key: "doble-llamado",
    name: "Doble llamado a la acción",
    strategy: "Un botón a mitad de la página y otro al final: para quien se decide leyendo.",
    shape: ["hero", "features", "promo", "comparison", "steps", "objections", "cta", "leadForm"],
    build: (n, a, b) => [hero(a, b, "split"), features(n, "icons"), promo(n, "soft"), comparison(n, b), steps(n), faq(n), cta(n), form(n)],
  },
  {
    key: "garantias-y-proceso",
    name: "Garantías y proceso",
    strategy: "Pone el proceso y las garantías al frente para bajar la sensación de riesgo.",
    shape: ["hero", "trustBar", "steps", "features", "host", "objections", "cta", "leadForm"],
    build: (n, a, b) => [hero(a, b, "split"), trust(n, 4), steps(n), features(n, "cards"), host(n, b), faq(n, 5), cta(n), form(n)],
  },
];
