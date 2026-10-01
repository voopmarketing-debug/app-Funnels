import { STYLE_THEME } from "@/lib/websiteStylePreview";
import type { CatalogProduct, PageType, Section, StyleKey, WebsiteContentV2 } from "@/lib/websiteContentV2";

/**
 * An example page for the creation studio's style previews: the same
 * renderer the real site uses, with the business's own name, products and
 * photos, so "how will my page look in this style" is answered by the page
 * itself instead of a mock. The copy is a neutral sample; the real page's
 * copy is written by the AI from the business's data.
 */

const SAMPLE_PRODUCTS: CatalogProduct[] = [
  ["Producto estrella", 129000, "Más vendido"],
  ["Edición especial", 159000, "Nuevo"],
  ["Kit completo", 219000, null],
  ["Básico", 69000, null],
  ["Pack x2", 119000, "-15%"],
  ["Regalo perfecto", 99000, null],
].map(([name, price, badge], i) => ({
  id: `muestra-${i}`,
  name: name as string,
  description: "Así se verá la descripción de tu producto.",
  price: price as number,
  compareAtPrice: null,
  currency: "COP",
  category: i % 2 === 0 ? "Destacados" : "Colección",
  imageUrl: null,
  badge: badge as string | null,
}));

export function sampleProducts(real: CatalogProduct[]): CatalogProduct[] {
  return real.length > 0 ? real : SAMPLE_PRODUCTS;
}

export function buildSampleContent(opts: { pageType: PageType; style: StyleKey; businessName: string; products: CatalogProduct[] }): WebsiteContentV2 {
  const { pageType, style, businessName } = opts;
  const first = opts.products[0];
  const ids = opts.products.map((p) => p.id);

  const benefits: Extract<Section, { type: "features" }> = {
    type: "features",
    variant: "cards",
    kicker: "Por qué elegirnos",
    heading: "Todo lo que necesitas, en un solo lugar",
    intro: null,
    items: [
      { title: "Atención inmediata", description: "Te respondemos por WhatsApp en minutos, todos los días.", icon: "chat" },
      { title: "Calidad garantizada", description: "Trabajamos con estándares altos en cada detalle.", icon: "shield" },
      { title: "Hecho para ti", description: "Una experiencia pensada para lo que de verdad necesitas.", icon: "heart" },
    ],
  };
  const faq: Extract<Section, { type: "objections" }> = {
    type: "objections",
    kicker: "Preguntas frecuentes",
    heading: "Resolvemos tus dudas antes de empezar",
    items: [
      { question: "¿Cómo empiezo?", answer: "Escríbenos por WhatsApp y te guiamos paso a paso." },
      { question: "¿Cuánto tarda?", answer: "Te damos tiempos claros desde el primer mensaje." },
      { question: "¿Qué pasa si no me convence?", answer: "Hablamos contigo hasta encontrar la mejor opción." },
    ],
  };
  const cta: Extract<Section, { type: "cta" }> = {
    type: "cta",
    heading: "Tu próximo paso empieza con un mensaje",
    body: "Sin compromiso: cuéntanos qué buscas y te respondemos hoy.",
    ctaLabel: "Escribir por WhatsApp",
  };
  const trust: Extract<Section, { type: "trustBar" }> = {
    type: "trustBar",
    items: [
      { icon: "truck", title: "Envíos a todo el país", description: "Recíbelo en tu puerta." },
      { icon: "card", title: "Pago seguro", description: "Varios medios de pago." },
      { icon: "chat", title: "Asesoría por WhatsApp", description: "Te acompañamos." },
    ],
  };

  let sections: Section[];
  switch (pageType) {
    case "tienda":
      sections = [
        { type: "hero", variant: "giant", eyebrow: "Nueva colección", heading: `Lo mejor de ${businessName}, a un clic`, highlight: "a un clic", subheading: "Elige tus favoritos y haz tu pedido por WhatsApp en segundos.", chips: [], showLeadForm: false, ctaLabel: "Ver catálogo", secondaryCtaLabel: null, badge: null, productId: null },
        trust,
        { type: "productGrid", variant: "row", kicker: "Novedades", heading: "Recién llegados", productIds: ids.slice(0, 4), showCategoryFilter: false },
        { type: "promo", tone: "dark", kicker: "Esta semana", heading: "Arma tu pedido y te lo enviamos", body: "Escríbenos y te ayudamos a elegir.", ctaLabel: "Pedir ahora" },
        { type: "productGrid", variant: "grid", kicker: null, heading: "Todo el catálogo", productIds: [], showCategoryFilter: true },
        faq,
        cta,
      ];
      break;
    case "producto":
      sections = [
        { type: "hero", variant: "product", eyebrow: "Edición disponible", heading: first ? first.name : "Tu producto estrella", highlight: null, subheading: "El producto que tus clientes estaban buscando, con envío a todo el país.", chips: [], showLeadForm: false, ctaLabel: "Pedir por WhatsApp", secondaryCtaLabel: null, badge: null, productId: first?.id ?? null },
        trust,
        ...(first
          ? [
              {
                type: "productSpotlight" as const,
                productId: first.id,
                heading: "Pensado para durar",
                bullets: [
                  { title: "Materiales premium", description: "Calidad que se nota desde el primer uso.", icon: "sparkle" as const },
                  { title: "Garantía real", description: "Te acompañamos después de la compra.", icon: "shield" as const },
                  { title: "Listo para regalar", description: "Llega bien presentado.", icon: "gift" as const },
                ],
                specs: [],
              },
            ]
          : []),
        {
          type: "comparison",
          heading: "La diferencia se nota",
          usLabel: businessName,
          othersLabel: "Lo típico",
          rows: [
            { label: "Atención", us: "Por WhatsApp, en minutos", others: "Correos sin respuesta" },
            { label: "Calidad", us: "Revisada una por una", others: "Variable" },
            { label: "Entrega", us: "Seguimiento hasta tu puerta", others: "Sin información" },
          ],
        },
        faq,
        cta,
      ];
      break;
    case "evento":
      sections = [
        { type: "hero", variant: "centered", eyebrow: "Evento en vivo", heading: "Aprende lo que nadie te había explicado", highlight: "nadie", subheading: `Una sesión práctica con ${businessName} para que salgas con un plan claro.`, chips: ["Jueves 7:00 p. m.", "En línea", "Cupos limitados"], showLeadForm: true, ctaLabel: "Reservar mi cupo", secondaryCtaLabel: null, badge: null, productId: null },
        { ...benefits, variant: "icons", kicker: "Lo que vas a aprender", heading: "Sales con resultados, no con teoría" },
        {
          type: "agenda",
          kicker: "Agenda",
          heading: "Así será la sesión",
          items: [
            { when: "7:00 p. m.", title: "Bienvenida", description: "Qué vas a lograr hoy." },
            { when: "7:15 p. m.", title: "Método paso a paso", description: "El corazón del evento." },
            { when: "8:00 p. m.", title: "Preguntas en vivo", description: "Resolvemos tu caso." },
          ],
        },
        { type: "host", kicker: "Quién te acompaña", heading: "Detrás de este evento", name: businessName, role: "Anfitrión", body: "Aquí va la presentación real de la persona o del equipo que dicta el evento." },
        faq,
        { type: "leadForm", kicker: null, heading: "Reserva tu cupo gratis", body: "Déjanos tus datos y te enviamos el enlace.", buttonLabel: "Quiero mi cupo" },
      ];
      break;
    case "captacion":
      sections = [
        { type: "hero", variant: "split", eyebrow: "Agenda tu cita", heading: "El primer paso hacia lo que buscas", highlight: "primer paso", subheading: `Déjanos tus datos y el equipo de ${businessName} te contacta hoy mismo.`, chips: [], showLeadForm: true, ctaLabel: "Quiero que me contacten", secondaryCtaLabel: null, badge: null, productId: null },
        benefits,
        {
          type: "steps",
          kicker: "Cómo funciona",
          heading: "Así de simple",
          items: [
            { title: "Déjanos tus datos", description: "Toma menos de un minuto." },
            { title: "Te contactamos", description: "Por WhatsApp, a la hora que prefieras." },
            { title: "Empiezas", description: "Con un plan claro y sin sorpresas." },
          ],
        },
        faq,
        { type: "leadForm", kicker: null, heading: "Hablemos hoy", body: "Sin compromiso. Te respondemos en minutos.", buttonLabel: "Enviar mis datos" },
      ];
      break;
    default:
      sections = [
        { type: "hero", variant: "split", eyebrow: businessName, heading: "Resultados que se notan desde el primer día", highlight: "se notan", subheading: "Te acompañamos de principio a fin para que tomes la mejor decisión.", chips: [], showLeadForm: false, ctaLabel: "Escribir por WhatsApp", secondaryCtaLabel: "Ver servicios", badge: null, productId: null },
        benefits,
        {
          type: "steps",
          kicker: "Cómo funciona",
          heading: "Tres pasos y listo",
          items: [
            { title: "Nos escribes", description: "Cuéntanos qué necesitas." },
            { title: "Te proponemos", description: "Una solución clara y a tu medida." },
            { title: "Lo hacemos realidad", description: "Con seguimiento en cada paso." },
          ],
        },
        faq,
        cta,
      ];
  }

  return {
    version: 2,
    pageType,
    style,
    announcement: pageType === "tienda" ? "Envíos a todo el país" : null,
    theme: STYLE_THEME[style] as WebsiteContentV2["theme"],
    sections,
    hidden: [],
    heroCtaUrl: null,
  };
}
