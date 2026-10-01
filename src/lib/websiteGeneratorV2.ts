import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropicClient";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import { INDUSTRY_LABELS, INDUSTRY_DIRECTION, type WebsiteGenerationContext } from "@/lib/websiteGenerator";
import {
  AiWebsiteV2Schema,
  PAGE_TYPES,
  STYLE_KEYS,
  type AiWebsiteV2,
  type CatalogProduct,
  type PageType,
  type StyleKey,
  type WebsiteContentV2,
  formatMoney,
} from "@/lib/websiteContentV2";

// Same model the v1 generator has been running on in production — a page
// is a single structured-output call that has to finish inside the
// request, and this keeps it well within the function time limit.
const MODEL = "claude-sonnet-5";

export type WebsiteV2Context = WebsiteGenerationContext & {
  products: CatalogProduct[];
  photoCount: number;
  pageType?: PageType | null;
  style?: StyleKey | null;
};

async function parseStructured<T extends z.ZodType>(schema: T, prompt: string, effort: "low" | "medium"): Promise<z.infer<T>> {
  let response;
  try {
    response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(schema), effort },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("websiteGeneratorV2: Anthropic call failed:", err);
    throw new Error(err instanceof Error ? err.message : "Falló la generación con IA");
  }
  if (response.stop_reason === "refusal") throw new Error("La IA no pudo generar esta página con esa instrucción. Prueba redactándola distinto.");
  if (!response.parsed_output) throw new Error("La IA no devolvió el contenido de la página");
  return response.parsed_output as z.infer<T>;
}

function productsBlock(products: CatalogProduct[]): string {
  if (products.length === 0) return "ninguno (el negocio todavía no ha cargado productos)";
  return products
    .slice(0, 60)
    .map((p) =>
      [
        `- id: ${p.id}`,
        `nombre: ${p.name}`,
        p.category ? `categoría: ${p.category}` : null,
        p.price !== null ? `precio: ${formatMoney(p.price, p.currency)}` : "precio: no publicado",
        p.compareAtPrice ? `precio antes: ${formatMoney(p.compareAtPrice, p.currency)}` : null,
        p.badge ? `etiqueta: ${p.badge}` : null,
        p.imageUrl ? "tiene foto" : "sin foto",
        p.description ? `descripción: ${p.description.slice(0, 300)}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

const STYLE_GUIDE = `1. editorial — EDITORIAL MINIMAL: lujo silencioso. Serif grande y fina, mucho aire, fotos grandes. Inmobiliaria, estética premium, moda, arquitectura, fotografía.
2. bold — BOLD TIPOGRÁFICO: titulares gigantes en mayúscula, bloques de color plano, bordes duros, cero sombras. Agencias, marcas jóvenes, streetwear, creadores.
3. tech — TECH PRECISO: fondo profundo tintado (o muy claro frío), bordes finos, brillo del acento, números grandes. Software, apps, cursos online, IA.
4. clinico — CLÍNICO SERENO: blanco roto frío, verdes/azules calmados, esquinas suaves, mucha legibilidad. Salud, odontología, psicología, laboratorios.
5. calido — CÁLIDO HUMANO: tonos cálidos, formas orgánicas, personas reales, cercanía. Coaches, terapeutas, fitness, educación, belleza.
6. gourmet — GOURMET SENSORIAL: crema u oscuro cálido, foto de comida protagonista, display con carácter. Restaurantes, cafés, repostería, licores.
7. producto — PRODUCTO PROTAGONISTA (ref. ficha tipo Aeroflow): foto grande del producto sobre fondo neutro, precio con ancla y ahorro, beneficios con íconos, especificaciones, garantías de compra, CTA de compra fijo en móvil. Skincare, suplementos, gadgets, accesorios.
8. tienda — TIENDA LIMPIA (ref. Stuffsus / NovaTrend / Urban Fit): barra superior con dato de envío o promo real, titular gigante tipo "Shop", franja de garantías (envío, pagos seguros, cambios, soporte) justo después de la portada, pestañas de categorías, rejilla de productos con badges ("Nuevo", "-20%"), fila de destacados, franjas promocionales oscuras, llamado final. Tiendas con varios productos.
9. lanzamiento — LANZAMIENTO / EVENTO (ref. webinars con fondo oscuro y acento eléctrico verde/teal): fondo muy oscuro tintado, palabra clave resaltada en el titular, chips de fecha/hora/modalidad, formulario de registro dentro de la portada, "lo que vas a aprender" numerado, "este evento es para ti si", presentador con foto, agenda de sesiones, registro repetido al final. Eventos, webinars, infoproductos, preventas.
10. corporativo — CORPORATIVO CONFIABLE: sobrio, rejilla ordenada, proceso por pasos, datos reales. Abogados, contadores, construcción, B2B, seguros.
11. pop — POP DIVERTIDO: colores vivos, esquinas muy redondeadas, tono simpático. Niños, mascotas, heladerías, regalos, marcas juveniles.
12. lujo — LUJO OSCURO: negro tintado, dorado o bronce apagado, serif elegante, detalles finos, mucho espacio. Joyería, relojes, autos, hoteles, eventos premium.`;

const PAGE_TYPE_GUIDE = `A. servicios — LANDING DE SERVICIOS: hero (split o centered) → trustBar opcional → features (lo que ofreces) → steps → features variant list (por qué elegirnos) → objections → cta (o leadForm).
B. producto — VENTA DE UN PRODUCTO FÍSICO: hero variant "product" con el productId protagonista → trustBar (envío, pago seguro, garantía, cambios: solo reales) → productSpotlight → features variant icons (beneficios) → comparison (nosotros vs lo típico) → objections → productGrid variant row (relacionados, si hay más productos) → cta.
C. tienda — TIENDA / CATÁLOGO: announcement con dato real → hero variant "giant" o "split" → trustBar → productGrid variant row (novedades o destacados) → promo tone dark → productGrid con showCategoryFilter true (todo el catálogo) → productGrid variant featured (más vendidos) si hay 6+ productos → objections → cta.
D. evento — EVENTO / LANZAMIENTO: hero con showLeadForm true y chips reales → features variant icons ("lo que vas a aprender") → features variant cards ("es para ti si…") → agenda (solo con fechas reales) → host → objections → leadForm (registro repetido).
E. captacion — CAPTACIÓN / AGENDA: hero con showLeadForm true → features (3 beneficios) → steps → objections → leadForm o cta.`;

/** The approved v2 prompt (role → data → strategy → page type → style → copy → truth → visual → review). */
function buildPrompt(ctx: WebsiteV2Context): string {
  const industryLabel = INDUSTRY_LABELS[ctx.industry] ?? INDUSTRY_LABELS.otro;
  const direction = INDUSTRY_DIRECTION[ctx.industry] ?? INDUSTRY_DIRECTION.otro;
  const location = [ctx.city, ctx.country].filter(Boolean).join(", ");
  const socials = [ctx.instagram && `Instagram: ${ctx.instagram}`, ctx.facebook && `Facebook: ${ctx.facebook}`, ctx.tiktok && `TikTok: ${ctx.tiktok}`]
    .filter(Boolean)
    .join(", ");

  return `ROL
Eres al mismo tiempo el director creativo y el copywriter de conversión de la mejor agencia de diseño web con IA del mundo: páginas con nivel visual de ganador de Awwwards y copy de especialista en respuesta directa que vende. Esta página es para un negocio REAL que va a recibir visitas reales: trátala como el proyecto más importante de la agencia.

DATOS DEL NEGOCIO
- Nombre: ${ctx.businessName}
- Rubro: ${industryLabel} (personalidad sugerida: ${direction})
- Qué hace y a quién le sirve (fuente real, escribe copy propio a partir de esto): ${ctx.description || "Negocio local; infiere servicios típicos del rubro sin inventar datos duros."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes: ${socials}` : ""}
- Objetivo de esta página: ${ctx.purpose || "presentar el negocio y que el visitante escriba por WhatsApp"}
${ctx.designPrompt ? `- BRIEF DEL CLIENTE (prioridad máxima si choca con otra regla de estilo): "${ctx.designPrompt}"` : ""}
${ctx.pageType ? `- TIPO DE PÁGINA ELEGIDO POR EL CLIENTE: ${ctx.pageType} (respétalo)` : ""}
${ctx.style ? `- ESTILO ELEGIDO POR EL CLIENTE: ${ctx.style} (respétalo)` : ""}
- Fotos reales del negocio disponibles: ${ctx.photoCount}
${ctx.salesContext ? `\nCONTEXTO REAL DE VENTAS (dudas y objeciones de sus clientes)\n${ctx.salesContext}\n` : ""}
PRODUCTOS reales cargados (usa SOLO estos ids; nunca inventes productos, precios ni descuentos):
${productsBlock(ctx.products)}

PASO 1 · ESTRATEGIA (piénsalo, no lo escribas)
1. ¿Quién es el cliente ideal exacto y qué situación lo trae a esta página?
2. ¿Qué resultado quiere y qué miedo o duda lo frena?
3. ¿Cuál es la idea central que hace distinto a este negocio? Toda la página gira alrededor de ella.
4. ¿Qué acción concreta debe tomar el visitante?

PASO 2 · TIPO DE PÁGINA (pageType) y orden de secciones recomendado
${PAGE_TYPE_GUIDE}
Si no hay productos cargados, NUNCA elijas producto ni tienda: usa servicios o captacion (un productGrid vacío no se muestra).

PASO 3 · ESTILO VISUAL (style): elige UNO según rubro, público y brief, sin mezclar
${STYLE_GUIDE}

PASO 4 · COPY (estándar de agencia)
- hero.heading: promesa concreta en máximo 10 palabras, con un detalle que solo este negocio podría decir. Sin preguntas retóricas ni el nombre del negocio. hero.highlight: 1 a 4 palabras exactas del heading para resaltar (la parte que más vende).
- hero.subheading: qué ofreces, a quién y cómo, máximo 30 palabras.
- Botones: 2 a 5 palabras, empiezan con verbo ("Pedir por WhatsApp", "Comprar ahora", "Quiero participar", "Agenda tu valoración").
- Títulos de sección: un beneficio o una idea, nunca una etiqueta genérica; la etiqueta va en kicker.
- Listas: features 3 a 6 ítems, steps 3 a 4, trustBar 3 a 4, objections 3 a 5, comparison 4 a 6 filas, productSpotlight 3 a 4 bullets.
- objections (la sección más importante): dudas reales del contexto de ventas, escritas como las diría el cliente; la respuesta empieza con sí, no o depende, y luego da la razón, máximo 40 palabras.
- Voz: la del mejor vendedor del negocio. Frases cortas, verbos activos. Tutea salvo que el público pida "usted"; sé consistente.
- Prohibido: "revoluciona", "desbloquea", "potencia", "siguiente nivel", "soluciones integrales", "de calidad", "tu mejor opción", emojis, exceso de exclamaciones y guion largo (—).

PASO 5 · REGLAS DE VERDAD (no negociables)
- Nunca inventes precios, descuentos, stock, reseñas, testimonios, calificaciones con estrellas, número de clientes, premios, certificaciones, años de experiencia ni fechas.
- announcement, badge, chips, stats y trustBar SOLO con datos reales dados arriba; si no hay, null / lista vacía / no uses la sección. Garantías de compra (envío, cambios) solo si aparecen en los datos; si no, usa garantías de proceso reales (respuesta rápida por WhatsApp, asesoría sin compromiso).
- Escasez y urgencia solo si son reales.
- productId y productIds: solo ids de la lista PRODUCTOS.

PASO 6 · ESTÁNDAR VISUAL (theme)
- backgroundColor nunca #ffffff ni #000000 puros; surfaceColor un paso más claro u oscuro que el fondo (tarjetas y franjas alternas).
- textColor con contraste ≥7:1 sobre el fondo; primaryColor con contraste ≥4.5:1 sobre el fondo.
- Estilos tech, lanzamiento y lujo van en modo oscuro (fondo profundo tintado); el resto normalmente claro salvo que el brief pida otra cosa.
- Un solo acento con intención. Nada del look genérico de IA: sin azul por defecto, sin degradado morado-azul, sin "beige + terracota", sin negro con verde lima neón (salvo lanzamiento, donde un verde/teal eléctrico sobre azul noche sí encaja).
- headingFont y bodyFont de esta lista: ${FONT_OPTIONS.join(", ")}. Pareja con contraste intencional (serif editorial + sans limpia, o display con carácter + sans legible).
- Variantes de hero: usa "product" solo con productId real; "fullbleed" o "split" si hay fotos (${ctx.photoCount} disponibles); "giant" para tiendas y marcas audaces; "centered" si no hay fotos.

PASO 7 · REVISIÓN FINAL ANTES DE RESPONDER
¿El titular solo podría ser de este negocio? ¿Cada sección tiene un dato concreto? ¿Hay algo inventado? ¿El estilo encaja con el rubro y el brief? ¿Algún texto suena a relleno de IA? Corrige lo que falle. La primera sección es siempre "hero"; entre 6 y 10 secciones en total.`;
}

function normalize(ai: AiWebsiteV2, ctx: { products: CatalogProduct[]; ctaUrl?: string | null }): WebsiteContentV2 {
  const ids = new Set(ctx.products.map((p) => p.id));
  const sections = ai.sections
    .filter((s) => {
      if (s.type === "productSpotlight") return ids.has(s.productId);
      if (s.type === "stats") return s.items.length >= 2;
      return true;
    })
    .map((s) => {
      if (s.type === "hero" && s.productId && !ids.has(s.productId)) return { ...s, productId: null, variant: s.variant === "product" ? ("split" as const) : s.variant };
      if (s.type === "productGrid") return { ...s, productIds: s.productIds.filter((id) => ids.has(id)) };
      return s;
    })
    .slice(0, 12);
  // Always open with a hero.
  const heroIndex = sections.findIndex((s) => s.type === "hero");
  if (heroIndex > 0) sections.unshift(...sections.splice(heroIndex, 1));
  return { ...ai, sections, version: 2, hidden: [], heroCtaUrl: ctx.ctaUrl || null };
}

export async function generateWebsiteContentV2(ctx: WebsiteV2Context): Promise<WebsiteContentV2> {
  const ai = await parseStructured(AiWebsiteV2Schema, buildPrompt(ctx), "medium");
  if (ctx.pageType) ai.pageType = ctx.pageType;
  if (ctx.style) ai.style = ctx.style;
  return normalize(ai, ctx);
}

/** Chat edits on an existing v2 page ("haz el titular más corto", "cámbialo a estilo lujo"). */
export async function applyWebsiteEditV2(
  current: WebsiteContentV2,
  instruction: string,
  products: CatalogProduct[],
): Promise<WebsiteContentV2> {
  const editable = { pageType: current.pageType, style: current.style, announcement: current.announcement, theme: current.theme, sections: current.sections };
  const prompt = `Aquí está el contenido actual de una página web, en JSON:

${JSON.stringify(editable, null, 2)}

PRODUCTOS reales disponibles (ids válidos):
${productsBlock(products)}

Estilos disponibles (campo style):
${STYLE_GUIDE}

El dueño del negocio pidió este cambio: "${instruction}"

Actúa como el director creativo de la mejor agencia de diseño web con IA del mundo. Devuelve la página COMPLETA en el mismo formato aplicando ese cambio. Todo lo que no tenga que ver con el pedido queda EXACTAMENTE igual: no reescribas texto que no te pidieron. Puedes agregar, quitar o reordenar secciones si el pedido lo implica.
Lo que cambies debe tener nivel de agencia premium: copy concreto, sin relleno de IA, sin emojis ni guion largo, sin inventar precios, reseñas, descuentos ni cifras. Si cambias colores: fondo nunca #ffffff/#000000 puros, texto ≥7:1, acento ≥4.5:1.`;
  const ai = await parseStructured(AiWebsiteV2Schema, prompt, "medium");
  const next = normalize(ai, { products, ctaUrl: current.heroCtaUrl });
  // Keep the owner's hide toggles only while the section list is the same shape.
  const sameShape = next.sections.length === current.sections.length && next.sections.every((s, i) => s.type === current.sections[i].type);
  return { ...next, hidden: sameShape ? current.hidden : [] };
}

// ---------------------------------------------------------------------------
// Lovable-style creation chat: the AI reads what the business already has in
// the platform, proposes concrete page ideas, asks only what it needs, and
// hands back a ready brief the "Crear página" button turns into a page.

export const CreationTurnSchema = z.object({
  reply: z.string().describe("Respuesta conversacional, cálida y breve (máx. 90 palabras), en español, sin emojis ni guion largo."),
  proposals: z
    .array(
      z.object({
        title: z.string().describe("Nombre corto de la idea, ej. 'Tienda con catálogo completo'"),
        pageType: z.enum(PAGE_TYPES).catch("servicios"),
        style: z.enum(STYLE_KEYS).catch("editorial"),
        why: z.string().describe("Por qué esta idea le sirve a ESTE negocio, una frase."),
        brief: z.string().describe("Brief listo para generar (máx. 80 palabras): objetivo, público, tono, qué destacar y llamado a la acción."),
      }),
    )
    .catch([])
    .describe("2 o 3 propuestas en el primer turno o cuando el usuario pida ideas; vacío en el resto."),
  quickReplies: z.array(z.string()).catch([]).describe("2 a 4 respuestas rápidas que el usuario podría tocar (máx. 6 palabras cada una)."),
  ready: z
    .object({
      pageType: z.enum(PAGE_TYPES).catch("servicios"),
      style: z.enum(STYLE_KEYS).catch("editorial"),
      name: z.string().describe("Nombre interno de la página, ej. 'Tienda principal'"),
      purpose: z.string().describe("Objetivo de la página en una frase"),
      brief: z.string().describe("Brief final consolidado de todo lo conversado (máx. 120 palabras)"),
    })
    .nullable()
    .catch(null)
    .describe("Solo cuando ya hay suficiente información para crear la página; si no, null."),
});
export type CreationTurn = z.infer<typeof CreationTurnSchema>;

export async function websiteCreationTurn(
  ctx: WebsiteV2Context,
  history: { role: "user" | "assistant"; text: string }[],
): Promise<CreationTurn> {
  const transcript =
    history.length === 0
      ? "(Aún no hay mensajes: es el primer turno. Saluda por el nombre del negocio, di en una frase lo que entendiste de él a partir de sus datos y propón 2 o 3 ideas de página.)"
      : history.map((m) => `${m.role === "user" ? "CLIENTE" : "TÚ"}: ${m.text}`).join("\n");
  const prompt = `Eres el director creativo de una agencia de diseño web con IA y estás conversando por chat con el dueño de un negocio para crear una página web. Tu trabajo: entender qué necesita, proponer ideas concretas basadas en lo que YA cargó en la plataforma y llegar rápido a un brief listo. Pregunta solo lo que de verdad falte (máximo una pregunta por turno). Cuando haya suficiente, llena "ready" y dile que puede tocar "Crear página".

DATOS QUE YA TIENE EN LA PLATAFORMA
- Negocio: ${ctx.businessName} (${INDUSTRY_LABELS[ctx.industry] ?? "otro"})
- Lo que hace: ${ctx.description.slice(0, 1500) || "sin descripción todavía"}
- Productos cargados: ${ctx.products.length}${ctx.products.length ? ` (ej. ${ctx.products.slice(0, 5).map((p) => p.name).join(", ")})` : ""}
- Fotos reales: ${ctx.photoCount}
${ctx.salesContext ? `- Lo que preguntan sus clientes: ${ctx.salesContext.slice(0, 800)}` : ""}

TIPOS DE PÁGINA
${PAGE_TYPE_GUIDE}

ESTILOS
${STYLE_GUIDE}

Reglas: no propongas tienda ni producto si no hay productos cargados (sugiérele cargarlos en Productos). No inventes datos. Español neutro, tuteo.

CONVERSACIÓN
${transcript}`;
  return parseStructured(CreationTurnSchema, prompt, "low");
}
