import { STYLE_THEME } from "@/lib/websiteStylePreview";
import type { Section, StyleKey, WebsiteContentV2 } from "@/lib/websiteContentV2";

// Ready-made landing pages by kind of business. The owner picks one, it is created at once
// (no AI, no cost, no waiting) with the business's name and brand color, and then edited in the
// builder like any other page. The copy only makes promises any business of the niche can keep and
// never invents prices, results, years of experience or numbers: whatever is specific to the
// business is for the owner to add.

export type NicheTemplate = {
  id: string;
  /** Who it is for, as the owner would say it. */
  niche: string;
  emoji: string;
  tagline: string;
  /** What the page includes, for the card. */
  includes: string[];
  style: StyleKey;
  /** Accent color when the business has no brand color of its own. */
  accent: string;
  build: (ctx: { businessName: string }) => { announcement: string | null; sections: Section[] };
};

const form = (kicker: string, heading: string, body: string, buttonLabel: string): Section => ({ type: "leadForm", kicker, heading, body, buttonLabel });

export const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: "contadores",
    niche: "Contadores y asesores tributarios",
    emoji: "📊",
    tagline: "Para que te escriban empresarios y emprendedores que quieren su contabilidad y sus impuestos al día.",
    includes: ["Portada con llamado a asesoría", "Servicios contables y tributarios", "Cómo trabajamos, en 4 pasos", "Preguntas frecuentes", "Formulario de contacto"],
    style: "corporativo",
    accent: "#1d4ed8",
    build: ({ businessName }) => ({
      announcement: null,
      sections: [
        {
          type: "hero",
          variant: "split",
          eyebrow: "Contabilidad e impuestos",
          heading: "Tu contabilidad al día, sin multas ni dolores de cabeza",
          highlight: "sin multas",
          subheading: `${businessName} lleva tus libros, tus impuestos y tu facturación para que tú te dediques a hacer crecer tu negocio.`,
          chips: ["Atención por WhatsApp", "Fechas claras de cada obligación"],
          showLeadForm: false,
          ctaLabel: "Quiero una asesoría",
          secondaryCtaLabel: "Ver servicios",
          badge: null,
          productId: null,
        },
        {
          type: "trustBar",
          items: [
            { icon: "chat", title: "Todo por WhatsApp", description: "Sin filas ni citas eternas." },
            { icon: "calendar", title: "Fechas claras", description: "Te avisamos antes de cada vencimiento." },
            { icon: "shield", title: "Información reservada", description: "Tus datos se manejan con confidencialidad." },
          ],
        },
        {
          type: "features",
          variant: "cards",
          kicker: "Lo que hacemos",
          heading: "Todo lo contable y tributario de tu negocio, en un solo lugar",
          intro: null,
          items: [
            { icon: "check", title: "Contabilidad mensual", description: "Registramos tus ingresos y gastos y te entregamos estados financieros claros." },
            { icon: "calendar", title: "Declaraciones de impuestos", description: "Renta, IVA, retención en la fuente e ICA presentados a tiempo." },
            { icon: "card", title: "Facturación electrónica", description: "Te ayudamos a facturar en regla y sin errores." },
            { icon: "users", title: "Nómina y seguridad social", description: "Liquidación de nómina y aportes al día." },
            { icon: "shield", title: "Constitución y trámites", description: "Creamos tu empresa y hacemos los trámites de registro." },
            { icon: "sparkle", title: "Asesoría para decidir", description: "Te explicamos tus números en palabras simples." },
          ],
        },
        {
          type: "steps",
          kicker: "Cómo trabajamos",
          heading: "Empezar es más sencillo de lo que crees",
          items: [
            { title: "Nos cuentas tu caso", description: "Por WhatsApp o en una llamada corta." },
            { title: "Revisamos tu situación", description: "Miramos tu contabilidad y tus obligaciones pendientes." },
            { title: "Te damos un plan claro", description: "Qué hacer, cuándo y cuánto cuesta, por escrito." },
            { title: "Nos encargamos", description: "Llevamos tus libros y presentamos todo a tiempo." },
          ],
        },
        {
          type: "host",
          kicker: "Quién está detrás",
          heading: "Un contador que te explica, no que te complica",
          name: businessName,
          role: "Contabilidad e impuestos",
          body: `En ${businessName} acompañamos a emprendedores y empresas para mantener su contabilidad y sus impuestos en orden, con un trato cercano y explicaciones en palabras simples.`,
        },
        {
          type: "objections",
          kicker: "Preguntas frecuentes",
          heading: "Resolvemos tus dudas antes de empezar",
          items: [
            { question: "¿Necesito llevar contabilidad si mi negocio es pequeño?", answer: "Depende de tu tipo de negocio. En la primera conversación te decimos qué obligaciones tienes y cuáles no." },
            { question: "¿Qué pasa si tengo declaraciones atrasadas?", answer: "Revisamos tu caso y te proponemos cómo ponerte al día, paso a paso." },
            { question: "¿Cuánto cuesta?", answer: "Depende del tamaño y la actividad de tu negocio. Te damos un valor claro por escrito antes de empezar." },
            { question: "¿Tengo que ir a una oficina?", answer: "No es necesario: puedes enviarnos todo por WhatsApp o correo y resolver dudas en una llamada." },
          ],
        },
        form("Hablemos", "Cuéntanos de tu negocio y te escribimos hoy", "Déjanos tus datos y te contactamos por WhatsApp. Sin compromiso.", "Quiero que me contacten"),
      ],
    }),
  },
  {
    id: "esteticas",
    niche: "Centros de estética y bienestar",
    emoji: "✨",
    tagline: "Para llenar tu agenda de valoraciones: tratamientos faciales, corporales, depilación y más.",
    includes: ["Portada con llamado a agendar valoración", "Tratamientos que ofreces", "Tu primera visita, en 4 pasos", "Preguntas frecuentes", "Formulario para agendar"],
    style: "calido",
    accent: "#b4533a",
    build: ({ businessName }) => ({
      announcement: null,
      sections: [
        {
          type: "hero",
          variant: "split",
          eyebrow: "Estética y bienestar",
          heading: "Luce y siéntete bien, con un plan hecho para ti",
          highlight: "hecho para ti",
          subheading: `En ${businessName} empezamos con una valoración y armamos tu tratamiento paso a paso, a tu ritmo.`,
          chips: ["Valoración personalizada", "Atención con cita"],
          showLeadForm: false,
          ctaLabel: "Agendar mi valoración",
          secondaryCtaLabel: "Ver tratamientos",
          badge: null,
          productId: null,
        },
        {
          type: "trustBar",
          items: [
            { icon: "check", title: "Valoración inicial", description: "Revisamos tu caso antes de recomendarte algo." },
            { icon: "heart", title: "Atención personalizada", description: "Un plan para tu piel y tus objetivos." },
            { icon: "shield", title: "Sin presiones", description: "Te explicamos las opciones y decides tú." },
          ],
        },
        {
          type: "features",
          variant: "cards",
          kicker: "Tratamientos",
          heading: "Cuidado para tu piel y tu cuerpo, en un solo lugar",
          intro: "Escríbenos y te contamos cuál va mejor con lo que buscas.",
          items: [
            { icon: "sparkle", title: "Faciales", description: "Limpieza, hidratación y cuidado de la piel." },
            { icon: "heart", title: "Corporales", description: "Tratamientos reductores, moldeadores y de bienestar." },
            { icon: "check", title: "Depilación", description: "Opciones para cada tipo de piel." },
            { icon: "leaf", title: "Masajes y relajación", description: "Un momento para desconectarte." },
            { icon: "star", title: "Manos y pies", description: "Manicure, pedicure y cuidado de uñas." },
            { icon: "sparkle", title: "Cejas y pestañas", description: "Diseño y cuidado para realzar tu mirada." },
          ],
        },
        {
          type: "steps",
          kicker: "Tu primera visita",
          heading: "Así empieza tu tratamiento",
          items: [
            { title: "Agenda tu valoración", description: "Escríbenos por WhatsApp y elige tu horario." },
            { title: "Conversamos y revisamos", description: "Entendemos qué quieres lograr." },
            { title: "Tu plan por escrito", description: "Tratamientos, número de sesiones y cuidados en casa." },
            { title: "Empezamos", description: "Cuando tú lo decidas." },
          ],
        },
        {
          type: "host",
          kicker: "Quién te atiende",
          heading: "Un equipo que se toma el tiempo de escucharte",
          name: businessName,
          role: "Estética y bienestar",
          body: `En ${businessName} creemos que cada piel es distinta. Por eso empezamos conversando contigo y te recomendamos solo lo que de verdad te conviene.`,
        },
        {
          type: "objections",
          kicker: "Preguntas frecuentes",
          heading: "Lo que casi todas se preguntan antes de agendar",
          items: [
            { question: "¿Duelen los tratamientos?", answer: "Depende del tratamiento. Antes de empezar te explicamos qué vas a sentir y tú decides si seguimos." },
            { question: "¿Cuántas sesiones necesito?", answer: "Se define en la valoración, según tu caso y lo que quieras lograr." },
            { question: "¿Puedo ir si tengo la piel sensible?", answer: "Sí. Cuéntanos tu caso en la valoración para elegir lo más adecuado para ti." },
            { question: "¿Cómo agendo?", answer: "Escríbenos por WhatsApp o deja tus datos en el formulario y te confirmamos tu cita." },
          ],
        },
        form("Agenda tu valoración", "Reserva tu cita hoy", "Déjanos tus datos y te confirmamos tu cita por WhatsApp.", "Quiero mi cita"),
      ],
    }),
  },
  {
    id: "odontologos",
    niche: "Odontólogos y clínicas dentales",
    emoji: "🦷",
    tagline: "Para recibir citas de valoración: limpieza, blanqueamiento, ortodoncia, implantes y más.",
    includes: ["Portada con llamado a agendar cita", "Tratamientos dentales", "Tu primera cita, en 4 pasos", "Preguntas frecuentes", "Formulario para agendar"],
    style: "clinico",
    accent: "#0e7490",
    build: ({ businessName }) => ({
      announcement: null,
      sections: [
        {
          type: "hero",
          variant: "split",
          eyebrow: "Odontología",
          heading: "Una sonrisa sana empieza con una buena valoración",
          highlight: "buena valoración",
          subheading: `En ${businessName} te atendemos con calma, te explicamos cada paso y te damos un plan claro para tu sonrisa.`,
          chips: ["Atención con cita previa", "Plan de tratamiento por escrito"],
          showLeadForm: false,
          ctaLabel: "Agendar mi cita",
          secondaryCtaLabel: "Ver tratamientos",
          badge: null,
          productId: null,
        },
        {
          type: "trustBar",
          items: [
            { icon: "chat", title: "Cita por WhatsApp", description: "Elige tu horario sin llamadas." },
            { icon: "check", title: "Plan claro", description: "Te explicamos el tratamiento y las opciones." },
            { icon: "heart", title: "Trato tranquilo", description: "Cuéntanos tus miedos, aquí te escuchamos." },
          ],
        },
        {
          type: "features",
          variant: "cards",
          kicker: "Tratamientos",
          heading: "Todo para el cuidado de tu sonrisa",
          intro: "Escríbenos y te orientamos sobre cuál necesitas.",
          items: [
            { icon: "check", title: "Valoración y limpieza", description: "Revisión completa y limpieza dental." },
            { icon: "sparkle", title: "Blanqueamiento", description: "Una sonrisa más luminosa, con seguimiento." },
            { icon: "star", title: "Ortodoncia", description: "Alinea tus dientes con el tratamiento que mejor se ajuste a ti." },
            { icon: "shield", title: "Calzas y endodoncia", description: "Tratamos caries y dolor para conservar tu diente." },
            { icon: "heart", title: "Implantes y rehabilitación", description: "Recupera tu masticación y tu sonrisa." },
            { icon: "users", title: "Odontopediatría", description: "Cuidado dental para los más pequeños de la casa." },
          ],
        },
        {
          type: "steps",
          kicker: "Tu primera cita",
          heading: "Así será tu primera visita",
          items: [
            { title: "Agenda tu cita", description: "Escríbenos por WhatsApp y escoge el horario." },
            { title: "Valoración", description: "Revisamos tu boca y escuchamos lo que te preocupa." },
            { title: "Tu plan por escrito", description: "Tratamientos, tiempos y opciones de pago." },
            { title: "Empezamos", description: "A tu ritmo y explicándote cada paso." },
          ],
        },
        {
          type: "host",
          kicker: "Quién te atiende",
          heading: "Odontología con calma y explicaciones claras",
          name: businessName,
          role: "Odontología",
          body: `En ${businessName} cuidamos tu sonrisa con un trato cercano. Te explicamos qué encontramos, qué opciones hay y tú decides cómo seguir.`,
        },
        {
          type: "objections",
          kicker: "Preguntas frecuentes",
          heading: "Resolvemos tus dudas antes de tu cita",
          items: [
            { question: "¿Me va a doler?", answer: "Trabajamos para que estés cómodo. Te explicamos cada paso y, cuando hace falta, usamos anestesia." },
            { question: "¿Atienden niños?", answer: "Cuéntanos la edad y te orientamos sobre la mejor forma de atenderlo." },
            { question: "¿Puedo pagar por partes?", answer: "Pregúntanos por las opciones de pago de tu tratamiento y te las explicamos antes de empezar." },
            { question: "¿Qué hago si tengo un dolor fuerte?", answer: "Escríbenos por WhatsApp y te orientamos para atenderte lo antes posible." },
          ],
        },
        form("Agenda tu cita", "Pide tu cita de valoración", "Déjanos tus datos y te confirmamos tu cita por WhatsApp.", "Quiero mi cita"),
      ],
    }),
  },
];

export function getNicheTemplate(id: string): NicheTemplate | null {
  return NICHE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** The page content for a template, with the business's name and brand color. */
export function buildNicheContent(template: NicheTemplate, opts: { businessName: string; brandColor?: string | null }): WebsiteContentV2 {
  const built = template.build({ businessName: opts.businessName });
  const accent = opts.brandColor && /^#[0-9a-fA-F]{6}$/.test(opts.brandColor) ? opts.brandColor : template.accent;
  return {
    version: 2,
    pageType: "captacion",
    style: template.style,
    announcement: built.announcement,
    theme: { ...STYLE_THEME[template.style], primaryColor: accent } as WebsiteContentV2["theme"],
    sections: built.sections,
    hidden: [],
    heroCtaUrl: null,
  };
}
