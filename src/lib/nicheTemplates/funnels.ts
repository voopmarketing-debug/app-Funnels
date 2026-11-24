import type { Section, StyleKey, WebsiteContentV2 } from "@/lib/websiteContentV2";
import { STYLE_THEME } from "@/lib/websiteStylePreview";

// Ready-made funnel pages (video sales letter, free guide, webinar, call, challenge, long sales
// letter, quote). Unlike the niche pages they are not tied to a kind of business: the copy is
// neutral and the owner makes it theirs. They are created as DRAFTS: they need the owner's own
// video link, date, testimonials, price or guarantee before the public sees them.
// Nothing here invents a price, a date, a result, a testimonial or a guarantee: the blocks that
// need those facts ship hidden (testimonials, offer, guarantee) or empty and invisible to the
// public (video without a link, event without a date) until the owner writes the real thing.

export type FunnelTemplate = {
  id: string;
  name: string;
  strategy: string;
  style: StyleKey;
  sticky?: boolean;
  counters?: boolean;
  /** Indexes (in `build`'s result) of blocks that start hidden: they wait for the owner's real data. */
  hiddenTypes: Section["type"][];
  build: (business: string) => Section[];
};

const fill = (text: string, business: string) => text.replaceAll("{negocio}", business);

type Hero = Extract<Section, { type: "hero" }>;
const hero = (b: string, o: Partial<Hero> & { heading: string; highlight: string; sub: string; cta: string; eyebrow: string }): Section => ({
  type: "hero",
  variant: o.variant ?? "centered",
  eyebrow: fill(o.eyebrow, b),
  heading: o.heading,
  highlight: o.highlight,
  subheading: fill(o.sub, b),
  chips: o.chips ?? [],
  showLeadForm: o.showLeadForm ?? false,
  ctaLabel: o.cta,
  secondaryCtaLabel: null,
  badge: null,
  productId: null,
});

const feat = (variant: "cards" | "icons" | "list" | "bento" | "numbered", kicker: string, heading: string, items: [string, string][]): Section => ({
  type: "features",
  variant,
  kicker,
  heading,
  intro: null,
  items: items.map(([title, description], i) => ({ icon: (["check", "star", "heart", "bolt", "shield", "chat"] as const)[i % 6], title, description })),
});
const steps = (variant: "row" | "timeline" | "big", kicker: string, heading: string, items: [string, string][]): Section => ({
  type: "steps",
  variant,
  kicker,
  heading,
  items: items.map(([title, description]) => ({ title, description })),
});
const faq = (items: [string, string][], b: string, variant: "list" | "split" = "split"): Section => ({
  type: "objections",
  variant,
  kicker: "Preguntas frecuentes",
  heading: "Lo que más nos preguntan",
  items: items.map(([question, answer]) => ({ question, answer: fill(answer, b) })),
});
const host = (b: string, kicker: string, heading: string, body: string): Section => ({ type: "host", kicker, heading, name: b, role: null, body: fill(body, b) });
const cta = (heading: string, body: string, label: string, variant: "band" | "giant" = "giant"): Section => ({ type: "cta", variant, heading, body, ctaLabel: label });
const form = (kicker: string, heading: string, body: string, button: string): Section => ({ type: "leadForm", kicker, heading, body, buttonLabel: button });
const video = (kicker: string, heading: string, intro: string): Section => ({ type: "video", kicker, heading, intro, url: "" });
const event = (heading: string, label: string): Section => ({ type: "event", kicker: "Próxima fecha", heading, when: "", where: "", date: "", ctaLabel: label });
const testimonials = (): Section => ({ type: "testimonials", kicker: "Lo que dicen", heading: "Personas que ya lo vivieron", items: [{ quote: "Escribe aquí el testimonio real de un cliente.", name: "Nombre del cliente", role: "" }] });
const offer = (heading: string, label: string): Section => ({ type: "offer", kicker: "Tu oferta", heading, body: "Cuenta en una frase qué recibe quien la toma.", price: "", priceNote: null, includes: ["Primera cosa que incluye", "Segunda cosa que incluye"], ctaLabel: label });
const guarantee = (): Section => ({ type: "guarantee", heading: "Tu garantía", body: "Escribe aquí los términos reales de tu garantía." });
const comparison = (b: string, heading: string, us: string, others: string, rows: [string, string, string][]): Section => ({
  type: "comparison",
  heading,
  usLabel: us,
  othersLabel: others,
  rows: rows.map(([label, a, c]) => ({ label, us: fill(a, b), others: c })),
});

const SAFE_FAQ: [string, string][] = [
  ["¿Escribirles me compromete a algo?", "No. Escribirnos es solo para conversar y resolver tus dudas."],
  ["¿Cuánto tardan en responder?", "Respondemos dentro del horario de atención de {negocio}."],
  ["¿Puedo preguntar antes de decidir?", "Claro. Escríbenos por WhatsApp y te respondemos con calma."],
];

export const FUNNELS: FunnelTemplate[] = [
  {
    id: "embudo-vsl",
    name: "Carta en video (VSL)",
    strategy: "Un video protagonista que explica todo y un solo paso final: escribirte.",
    style: "bold",
    sticky: true,
    hiddenTypes: ["testimonials", "offer", "guarantee"],
    build: (b) => [
      hero(b, { eyebrow: "Mira el video primero", heading: "Mira este video antes de decidir", highlight: "este video", sub: "En pocos minutos te explicamos qué hacemos, para quién es y cómo es trabajar con {negocio}.", cta: "Quiero dar el primer paso" }),
      video("Dale play", "Así podemos ayudarte", "Míralo completo: al final te decimos cómo seguir."),
      feat("list", "Lo que vas a ver", "Todo lo que se explica en el video", [
        ["Qué problema resolvemos y para quién", "Para que sepas si esto es lo que buscas."],
        ["Cómo trabajamos, paso a paso", "Sin sorpresas ni letra pequeña."],
        ["Qué necesitas para empezar", "Lo mínimo para dar el primer paso."],
        ["Cómo seguir con {negocio}", "El siguiente paso, explicado con claridad."],
      ]),
      host(b, "Quién te lo cuenta", "Conoce a quien da la cara", "Somos {negocio}. En el video te contamos quiénes somos y cómo trabajamos; aquí puedes agregar la historia de quien aparece en él."),
      testimonials(),
      offer("Escribe el nombre de tu oferta", "Lo quiero"),
      guarantee(),
      faq(SAFE_FAQ, b),
      cta("Ya viste el video. ¿Hablamos?", "Escríbenos por WhatsApp y te contamos los pasos.", "Escribir por WhatsApp"),
      form("Prefiero que me escriban", "Déjanos tus datos", "Te escribimos pronto. Sin compromiso.", "Quiero que me contacten"),
    ],
  },
  {
    id: "embudo-lead-magnet",
    name: "Regalo gratis (lead magnet)",
    strategy: "Ofrece una guía o recurso gratis a cambio de los datos de contacto.",
    style: "tech",
    hiddenTypes: ["testimonials"],
    build: (b) => [
      hero(b, { variant: "split", showLeadForm: true, eyebrow: "Guía gratis", heading: "Recibe gratis tu guía", highlight: "gratis", sub: "Déjanos tus datos y te la enviamos. Sin costo y sin compromiso.", cta: "Quiero mi guía" }),
      feat("list", "Qué incluye", "Lo que encontrarás dentro", [
        ["Los errores más comunes y cómo evitarlos", "Para que no pierdas tiempo."],
        ["Una lista de pasos para empezar", "Ordenada y fácil de seguir."],
        ["Recomendaciones claras", "Sin tecnicismos."],
        ["Respuestas a las dudas más frecuentes", "Todo en un solo lugar."],
      ]),
      steps("big", "Cómo la recibes", "Tres pasos y es tuya", [
        ["Déjanos tus datos", "Solo te pedimos lo necesario."],
        ["Te la enviamos", "La recibes por el medio que nos dejaste."],
        ["Empieza a aplicarla", "A tu ritmo, cuando quieras."],
      ]),
      host(b, "Quién la preparó", "Hecha por quienes lo hacen a diario", "Esta guía la preparó el equipo de {negocio}. Aquí puedes contar quién eres y por qué la creaste."),
      testimonials(),
      faq(
        [
          ["¿De verdad es gratis?", "Sí. Recibirla no tiene ningún costo."],
          ["¿Qué hacen con mis datos?", "Los usamos para enviarte la guía y responderte, con tu autorización y según la política de datos de {negocio}."],
          ["¿Me van a llenar de mensajes?", "Solo te escribimos sobre lo que pediste."],
        ],
        b,
        "list",
      ),
      cta("¿Lista para recibirla?", "Déjanos tus datos arriba y es tuya.", "Quiero mi guía", "band"),
    ],
  },
  {
    id: "embudo-webinar",
    name: "Clase en vivo (webinar)",
    strategy: "Registro a una clase en línea, con fecha, cuenta regresiva y anfitrión.",
    style: "lanzamiento",
    sticky: true,
    hiddenTypes: ["testimonials"],
    build: (b) => [
      hero(b, { variant: "split", showLeadForm: true, eyebrow: "Clase en vivo", heading: "Reserva tu lugar en nuestra clase en línea", highlight: "clase en línea", sub: "Una conversación para resolver tus dudas con quienes lo hacen todos los días en {negocio}.", cta: "Reservar mi lugar", chips: ["En vivo", "Con espacio para preguntas"] }),
      event("Aparta la fecha", "Reservar mi lugar"),
      feat("numbered", "Lo que aprenderás", "Qué vamos a ver en la clase", [
        ["Por dónde empezar", "El primer paso, explicado sin tecnicismos."],
        ["Los errores que conviene evitar", "Lo que más se repite y cómo esquivarlo."],
        ["Cómo aplicarlo en tu caso", "Con ejemplos cercanos a tu realidad."],
        ["Tus preguntas, respondidas", "Un espacio para preguntar en vivo."],
      ]),
      host(b, "Quién la dará", "Conoce a tu anfitrión", "Te acompaña el equipo de {negocio}. Aquí puedes presentar a quien dará la clase: quién es y qué lo hace la persona indicada."),
      testimonials(),
      faq(
        [
          ["¿Tiene algún costo?", "Escríbenos y te confirmamos todos los detalles."],
          ["¿Y si no puedo conectarme en vivo?", "Escríbenos y te contamos qué opciones hay."],
          ["¿Cómo me entero del enlace?", "Te lo enviamos por el medio que dejes al registrarte."],
        ],
        b,
      ),
      cta("Tu lugar te espera", "Regístrate y te avisamos antes de empezar.", "Reservar mi lugar"),
    ],
  },
  {
    id: "embudo-llamada",
    name: "Llamada de diagnóstico",
    strategy: "Filtra y agenda llamadas: explica cómo es, para quién sí y para quién no.",
    style: "corporativo",
    sticky: true,
    hiddenTypes: ["testimonials"],
    build: (b) => [
      hero(b, { eyebrow: "Llamada sin compromiso", heading: "Agenda una llamada para ver si podemos ayudarte", highlight: "si podemos ayudarte", sub: "Conversamos de tu caso y te decimos con honestidad si {negocio} es lo que necesitas.", cta: "Quiero mi llamada" }),
      steps("timeline", "Cómo funciona", "Así es la llamada", [
        ["Nos cuentas tu situación", "Escuchamos qué buscas y qué has intentado."],
        ["Revisamos las opciones", "Te explicamos qué tiene sentido y qué no."],
        ["Decides con calma", "Sin presión: tú eliges si seguimos."],
      ]),
      comparison(b, "¿Es para ti?", "Sí es para ti si…", "Quizás no si…", [
        ["Tu objetivo", "Tienes claro qué quieres lograr", "Aún no sabes qué buscas"],
        ["Tu disposición", "Estás listo para dar el paso", "Solo estás mirando por curiosidad"],
        ["Tu momento", "Puedes dedicarle tiempo ahora", "Necesitas dejarlo para más adelante"],
      ]),
      host(b, "Con quién hablas", "Conoce a quien te atiende", "Hablas directamente con el equipo de {negocio}. Aquí puedes presentar a quien atiende las llamadas."),
      testimonials(),
      faq(SAFE_FAQ, b),
      form("Solicitud", "Cuéntanos de ti", "Déjanos tus datos y te escribimos para coordinar la llamada.", "Quiero mi llamada"),
    ],
  },
  {
    id: "embudo-reto",
    name: "Reto de varios días",
    strategy: "Invita a un reto guiado: ritmo claro, comunidad y un primer resultado.",
    style: "pop",
    sticky: true,
    counters: true,
    hiddenTypes: ["testimonials", "guarantee"],
    build: (b) => [
      hero(b, { variant: "wordmark", eyebrow: "Únete al reto", heading: "Un reto para dar el primer paso con {negocio}", highlight: "dar el primer paso", sub: "Te guiamos día a día para que empieces y no lo dejes a medias.", cta: "Quiero unirme" }),
      event("Cuándo empieza", "Quiero unirme"),
      steps("big", "El reto", "Así avanzamos", [
        ["Día uno: empezamos", "Lo básico para arrancar bien."],
        ["Día dos: avanzamos", "Lo aplicas con nuestra guía."],
        ["Día tres: lo consolidamos", "Cerramos con un resultado propio."],
      ]),
      feat("bento", "Qué recibes", "Lo que incluye el reto", [
        ["Guía diaria", "Qué hacer cada día, sin enredos."],
        ["Acompañamiento", "Resuelves tus dudas con el equipo."],
        ["Ritmo claro", "Sabes qué sigue en cada paso."],
        ["Comunidad", "Avanzas junto a otras personas."],
        ["Un resultado a tu medida", "Terminas con algo propio."],
      ]),
      host(b, "Quién te guía", "Conoce a tu guía", "Te acompaña el equipo de {negocio}. Aquí puedes presentar a quien guiará el reto."),
      guarantee(),
      testimonials(),
      faq(SAFE_FAQ, b),
      form("Súmate", "Quiero unirme al reto", "Déjanos tus datos y te avisamos cuando abramos lugares.", "Quiero unirme"),
    ],
  },
  {
    id: "embudo-carta-ventas",
    name: "Carta de ventas larga",
    strategy: "Cuenta la historia completa: problema, solución, oferta, garantía y cierre.",
    style: "editorial",
    sticky: true,
    hiddenTypes: ["testimonials", "offer", "guarantee"],
    build: (b) => [
      hero(b, { variant: "giant", eyebrow: "Para ti", heading: "Lo que buscas, bien resuelto", highlight: "bien resuelto", sub: "Lee con calma: aquí te explicamos cómo {negocio} puede ayudarte.", cta: "Quiero saber más" }),
      feat("list", "¿Te suena familiar?", "Esto es lo que suele pasar", [
        ["Pierdes tiempo buscando por tu cuenta", "Y al final no sabes si elegiste bien."],
        ["Nadie te explica con claridad", "Las respuestas llegan tarde o incompletas."],
        ["Te cuesta confiar", "No sabes a quién creerle."],
      ]),
      comparison(b, "Hacerlo solo o con {negocio}", "Con {negocio}", "Por tu cuenta", [
        ["Claridad", "Te explicamos cada paso", "Aprendes a los golpes"],
        ["Tiempo", "Vas directo a lo importante", "Pruebas y repruebas"],
        ["Acompañamiento", "Tienes a quién preguntar", "Decides sin apoyo"],
      ]),
      feat("numbered", "La solución", "Cómo lo resolvemos", [
        ["Escuchamos tu caso", "Entendemos qué necesitas de verdad."],
        ["Te proponemos un camino", "Claro, por escrito y a tu medida."],
        ["Lo ejecutamos contigo", "Con seguimiento hasta el final."],
      ]),
      host(b, "Quiénes somos", "Detrás de {negocio}", "Somos {negocio}. Aquí puedes contar tu historia: de dónde vienes y por qué haces lo que haces."),
      testimonials(),
      offer("Escribe el nombre de tu oferta", "Lo quiero"),
      guarantee(),
      faq(SAFE_FAQ, b, "list"),
      cta("Es hora de dar el paso", "Escríbenos por WhatsApp y empezamos.", "Escribir por WhatsApp"),
      form("Contacto", "Déjanos tus datos", "Te escribimos pronto. Sin compromiso.", "Quiero que me contacten"),
    ],
  },
  {
    id: "embudo-cotizacion",
    name: "Cotización rápida",
    strategy: "Formulario desde el primer vistazo para pedir una propuesta sin vueltas.",
    style: "calido",
    sticky: true,
    hiddenTypes: ["testimonials"],
    build: (b) => [
      hero(b, { variant: "split", showLeadForm: true, eyebrow: "Cotización", heading: "Pide tu cotización sin compromiso", highlight: "sin compromiso", sub: "Cuéntanos qué necesitas y {negocio} te responde con una propuesta.", cta: "Pedir mi cotización" }),
      { type: "trustBar", variant: "ticker", items: [
        { icon: "chat", title: "Respuesta por WhatsApp", description: "Te escribimos directo." },
        { icon: "shield", title: "Sin compromiso", description: "Cotizar no te obliga a nada." },
        { icon: "check", title: "Propuesta clara", description: "Por escrito y fácil de entender." },
      ] },
      feat("icons", "Qué recibes", "Tu cotización incluye", [
        ["Lo que necesitas, por escrito", "Para que lo revises con calma."],
        ["Los pasos para empezar", "Qué sigue si te interesa."],
        ["Una persona de contacto", "Para resolver tus dudas."],
      ]),
      steps("timeline", "Cómo funciona", "De la solicitud a la propuesta", [
        ["Nos cuentas qué necesitas", "Con el formulario es suficiente."],
        ["Preparamos tu propuesta", "La revisamos con atención."],
        ["Te la enviamos", "Tú decides si seguimos."],
      ]),
      testimonials(),
      faq(SAFE_FAQ, b, "list"),
      cta("¿Listo para tu cotización?", "Completa el formulario y te respondemos.", "Pedir mi cotización", "band"),
    ],
  },
];

export const FUNNEL_NICHE = { id: "embudos", name: "Embudos de venta", short: "Embudos", emoji: "🎯" } as const;

export function getFunnelTemplate(id: string): FunnelTemplate | null {
  return FUNNELS.find((f) => f.id === id) ?? null;
}

export function buildFunnelContent(funnel: FunnelTemplate, opts: { businessName: string; brandColor?: string | null }): WebsiteContentV2 {
  // Every "{negocio}" in the copy becomes the business's name.
  const sections = JSON.parse(JSON.stringify(funnel.build(opts.businessName)).replaceAll("{negocio}", JSON.stringify(opts.businessName).slice(1, -1))) as Section[];
  const accent = opts.brandColor && /^#[0-9a-fA-F]{6}$/.test(opts.brandColor) ? opts.brandColor : STYLE_THEME[funnel.style].primaryColor;
  return {
    version: 2,
    pageType: "captacion",
    style: funnel.style,
    announcement: null,
    theme: { ...STYLE_THEME[funnel.style], primaryColor: accent } as WebsiteContentV2["theme"],
    sections,
    hidden: sections.flatMap((s, i) => (i > 0 && funnel.hiddenTypes.includes(s.type) ? [i] : [])),
    ...(funnel.counters ? { counters: true } : {}),
    ...(funnel.sticky ? { sticky: true } : {}),
    heroCtaUrl: null,
  };
}
