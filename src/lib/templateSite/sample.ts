import { ShowroomSchema, StorySchema, type TemplateKey, type TemplateSiteContent } from "./content";

/**
 * An example Showroom / Scroll Story page for the creation studio's previews: the same
 * template and renderer the real page uses, with this business's own name, products and
 * photos. The copy is a neutral sample; the real texts are written by the AI at creation.
 */
export function buildSampleTemplate(template: TemplateKey, businessName: string, accent?: string | null): TemplateSiteContent {
  const brand = { name: businessName, accent: accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#3457ff" };
  if (template === "showroom") {
    return ShowroomSchema.parse({
      version: 3, template: "showroom", brand, noun: "producto",
      ticker: ["Atención inmediata", "Cotiza con tu presupuesto", "Agenda tu visita", "Atención personalizada"],
      promo: { tag: "Solo en {mes}", title: "Tu oferta del mes", text: "Aquí va la oferta real de tu negocio.", cta: "Quiero la oferta", stamp: null, countdown: false },
      hero: { title: "Tu próxima compra, sin vueltas.", text: `Conoce de cerca lo mejor de ${businessName} y encuentra lo que te alcanza.`, primaryCta: "Cotizar con mi presupuesto", secondaryCta: "Agendar visita" },
      items: [],
      quote: { kicker: "Cotizador", title: "¿Cuánto quieres invertir?", text: "Mueve la barra con tu presupuesto y te mostramos qué te alcanza.", months: 48, ratePct: null, downPct: 0 },
      services: { kicker: "Servicios", title: "Todo más fácil", text: "", cards: [{ icon: "card", title: "Financiación", text: "Te asesoramos con la mejor opción." }, { icon: "refresh", title: "Recibimos el tuyo", text: "Tu producto actual como parte de pago." }, { icon: "check", title: "Entrega lista", text: "Con todo en regla desde el primer día." }], trade: null, side: [] },
      visit: { kicker: "Visita", title: "Agenda tu visita", text: "Déjanos tus datos y te confirmamos por WhatsApp.", where: [], button: "Pedir mi visita" },
      footer: "",
    });
  }
  return StorySchema.parse({
    version: 3, template: "story", brand,
    ticker: ["Hecho con cuidado", "Producto real", "Atención cercana"],
    promo: { tag: "Solo en {mes}", title: "Tu oferta del mes", text: "Aquí va la oferta real de tu negocio.", cta: "Quiero la oferta", stamp: null, countdown: false },
    hero: { kicker: businessName, title: "Hecho para que lo disfrutes.", text: "Una experiencia pensada al detalle, de principio a fin.", primaryCta: "Agendar", secondaryCta: "Ver colección", trust: [] },
    ritual: { title: "El ritual empieza.", text: "", link: "Conocer más", benefits: [{ title: "Pensado para ti", text: "Cada detalle tiene un porqué." }, { title: "Calidad real", text: "Lo que ves es lo que recibes." }, { title: "Cerca de ti", text: "Te acompañamos en cada paso." }], spec: [] },
    marquee: { rows: ["Hecho con cuidado", "Pensado para ti"], tags: [] }, inside: null,
    collection: { kicker: "La colección", title: "Elige la tuya" }, items: [],
    visit: { title: "Tu primera visita.", text: "", steps: [{ title: "Escríbenos", text: "Cuéntanos qué buscas.", meta: null }, { title: "Te asesoramos", text: "Te mostramos las mejores opciones.", meta: null }, { title: "Disfrútalo", text: "Todo listo para ti.", meta: null }] },
    book: { title: "Tu momento empieza aquí.", text: "Déjanos tus datos y te confirmamos por WhatsApp.", facts: [], button: "Pedir mi cita" },
    footer: "",
  });
}
