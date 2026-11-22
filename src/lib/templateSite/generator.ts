import { paletteHint } from "@/lib/designIntel";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropicClient";
import { recordAnthropicUsage } from "@/lib/aiUsage";
import { INDUSTRY_LABELS, INDUSTRY_DIRECTION } from "@/lib/websiteGenerator";
import { formatMoney, type CatalogProduct } from "@/lib/websiteContentV2";
import type { WebsiteV2Context } from "@/lib/websiteGeneratorV2";
import { ShowroomSchema, StorySchema, TemplateSiteSchema, type TemplateKey, type TemplateSiteContent } from "./content";

const MODEL = "claude-sonnet-5";

export type TemplateGenContext = WebsiteV2Context & { template: TemplateKey };

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("La respuesta no trae JSON");
  return JSON.parse(text.slice(start, end + 1));
}

// Same approach as the v2 pages: the JSON Schema goes in the prompt, the answer is validated with
// zod and retried once with the validation error.
async function generateJson<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const instructions = `${prompt}

FORMATO DE RESPUESTA
Responde SOLO con un objeto JSON válido (sin texto antes ni después, sin \`\`\`) que cumpla este JSON Schema. Incluye todos los campos; usa null o [] en los que no apliquen.
${JSON.stringify(zodOutputFormat(schema).schema)}`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: attempt === 0 ? instructions : `${instructions}\n\nTu respuesta anterior no se pudo usar (${lastError}). Devuelve el JSON completo y válido.` }],
    });
    await recordAnthropicUsage(MODEL, response.usage);
    if (response.stop_reason === "refusal") throw new Error("La IA no pudo generar esta página con esa instrucción. Prueba redactándola distinto.");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (err) {
      lastError = response.stop_reason === "max_tokens" ? "se cortó por largo" : err instanceof Error ? err.message : "JSON inválido";
    }
    console.error(`generateTemplateJson attempt ${attempt + 1} unusable: ${lastError}`);
  }
  throw new Error("La IA devolvió una página incompleta. Intenta de nuevo.");
}

function productsBlock(products: CatalogProduct[]): string {
  if (products.length === 0) return "ninguno";
  return products
    .slice(0, 40)
    .map((p) =>
      [
        `- id: ${p.id}`,
        `nombre: ${p.name}`,
        p.category ? `categoría: ${p.category}` : null,
        p.price !== null ? `precio: ${formatMoney(p.price, p.currency)}` : "precio: no publicado",
        p.badge ? `etiqueta: ${p.badge}` : null,
        p.imageUrl ? `foto: sí${(p.galleryUrls?.length ?? 0) >= 2 ? ` (${(p.galleryUrls?.length ?? 0) + 1} ángulos)` : ""}` : "foto: no",
        p.description ? `descripción: ${p.description.slice(0, 500)}` : "descripción: (vacía)",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

const ROLE = `ROL
Eres el constructor de sitios web de Funnels Labs. Construyes landing pages de nivel agencia para negocios reales: concesionarios, clínicas estéticas, gimnasios, restaurantes, tiendas, inmobiliarias y servicios. Cada página debe verse como hecha por un estudio de diseño premium, no como una plantilla genérica. Además eres el copywriter de conversión del negocio. Tu trabajo aquí NO es diseñar: el diseño, el movimiento y las interacciones ya están construidos en la plantilla. Tu trabajo es llenar los textos y los datos con precisión y con la voz del mejor vendedor del negocio.`;

const TRUTH = `REGLAS DE VERDAD (no negociables)
- Usa SOLO datos que aparezcan en "DATOS DEL NEGOCIO", en "BRIEF DEL CLIENTE" o en el CATÁLOGO. Nunca inventes precios, descuentos, tasas de interés, cuota inicial, stock, reseñas, testimonios, cifras, premios, garantías, años de experiencia, fechas, direcciones, horarios ni especificaciones técnicas.
- Si no tienes un dato real, deja el campo vacío ("" o null o lista vacía) y la plantilla omite esa pieza. Una página corta y verdadera vale más que una larga con datos inventados.
- Los textos de "stats", "bubbles", "facts", "side", "stamp", "ticker" y "where" son datos: solo si son reales.
- ratePct y downPct solo si el cliente los dio; si no, ratePct null y downPct 0 (la plantilla dice que es una simulación sin intereses).
- countdown (cuenta regresiva hasta fin de mes) solo es true si la oferta de verdad cierra el último día del mes; si no hay oferta real, countdown false, stamp null y el banner invita a agendar este mes.
- Los procedimientos médicos o estéticos aclaran que requieren valoración previa. Las cuotas y tasas son simulaciones de referencia.
- productId: solo ids de la lista CATÁLOGO.

REGLAS DE TEXTO
- Español de Colombia, claro y directo. Frases cortas, verbos activos. Tutea de forma consistente.
- Titulares que dicen el beneficio ("Tu próximo carro, sin vueltas", "Tu piel merece un plan, no un impulso"). Sin preguntas retóricas.
- Botones de 2 a 5 palabras que empiezan con verbo.
- Prohibido: "revoluciona", "desbloquea", "potencia", "siguiente nivel", "soluciones integrales", "de calidad", "tu mejor opción", emojis y el guion largo (—). Nunca escribas "demo", "ejemplo" ni "lorem".
- En promo.tag y promo.title puedes usar {mes}: se cambia solo por el mes actual.`;

const SHOWROOM_GUIDE = `PLANTILLA: SHOWROOM (productos que se comparan: carros, motos, inmuebles, planes, equipos)
La página tiene, en este orden: cinta superior en movimiento (ticker), portada con titular y un visor del producto que el visitante gira y compara (los globos y los datos clave salen de "items"), banner de promoción con cuenta regresiva, cotizador por presupuesto (precio total o cuota mensual: la plantilla calcula "te alcanza / te faltan"), bloque de servicios (3 tarjetas, una franja grande con imagen y 3 cifras) y formulario de visita.
Cómo llenarla:
- noun: lo que vende, minúscula y singular (carro, moto, apartamento).
- hero.title: promesa concreta de máx. 10 palabras. hero.text: qué puede hacer el visitante aquí.
- ticker: 3 a 5 beneficios reales cortos.
- items: una entrada por cada producto del catálogo cuya descripción dé datos reales. stats = hasta 3 datos clave (icon: gauge potencia, gear caja, box baúl/capacidad, road recorrido/tracción, seat puestos, bolt, tow, tag, calendar, shield, star, check). bubbles = hasta 3 características reales para los globos del visor. sub = línea corta tipo "Sedán · 2025 · 0 km" solo con datos reales.
- promo: oferta real del mes si el cliente la dio; si no, una invitación a agendar este mes sin cuenta regresiva ni sello.
- quote: textos del cotizador; months, ratePct y downPct según las reglas de verdad.
- services: 3 beneficios del servicio (financiación, retoma, entrega…) solo reales; trade = la franja grande (ej. "Recibimos tu carro actual") si aplica; side = 3 cifras reales o [].
- visit.where: dirección, horario y qué traer, solo si los tienes.`;

const STORY_GUIDE = `PLANTILLA: SCROLL STORY (productos de marca o de ritual: cosmética, estética, bebidas, perfumes, comida, suplementos)
La página tiene: cinta superior en movimiento, portada con la marca gigante al fondo, titular en serif y el producto protagonista que VIAJA y GIRA mientras se hace scroll (portada, ritual, texto en movimiento, ingredientes), colección en abanico que gira sola y se arrastra con una ficha de cada producto (pestañas), banner de promoción con cuenta regresiva, pasos de la primera visita o compra, tarjeta para agendar y la marca gigante al pie.
Cómo llenarla:
- brand.name: el nombre de la marca; la palabra gigante sale de aquí.
- hero: kicker corto, title en pocas palabras (en mayúsculas lo pone la plantilla), text, ctas, trust = hasta 3 sellos reales con ícono (shield, drop, check, leaf, heart, sparkle, star).
- ritual: title, text y 3 beneficios reales; spec = 2 líneas cortas de ficha solo con datos reales.
- marquee.rows: 2 frases cortas que se desplazan gigantes; tags = hasta 3 etiquetas reales.
- inside: 4 ingredientes o componentes REALES tomados de las descripciones; si no hay datos reales, null.
- collection.title: titular de la colección (ej. "Cinco tratamientos. Un solo ritual.").
- items: por producto, solo con datos de su descripción: zone, what, results, duration, sessions, after, pack.
- visit.steps: 3 pasos reales de la primera visita o compra, con meta corta ("30 min").
- book.facts: hasta 3 datos reales (valor de la valoración, dirección, importante).`;

function businessBlock(ctx: TemplateGenContext): string {
  const location = [ctx.city, ctx.country].filter(Boolean).join(", ");
  const socials = [ctx.instagram && `Instagram: ${ctx.instagram}`, ctx.facebook && `Facebook: ${ctx.facebook}`, ctx.tiktok && `TikTok: ${ctx.tiktok}`].filter(Boolean).join(", ");
  return `DATOS DEL NEGOCIO
- Nombre: ${ctx.businessName}
- Rubro: ${INDUSTRY_LABELS[ctx.industry] ?? INDUSTRY_LABELS.otro} (personalidad sugerida: ${INDUSTRY_DIRECTION[ctx.industry] ?? INDUSTRY_DIRECTION.otro})
- Qué hace y a quién le sirve (fuente real): ${ctx.description || "Negocio local; no inventes datos duros."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes: ${socials}` : ""}
- Objetivo de la página: ${ctx.purpose || "que el visitante agende o escriba por WhatsApp"}
${ctx.designPrompt ? `- BRIEF DEL CLIENTE (prioridad máxima; de aquí salen también datos reales como ofertas, tasas, direcciones y horarios): "${ctx.designPrompt}"` : ""}
${ctx.brandColors?.primary ? `- COLOR DE MARCA: ${ctx.brandColors.primary} (úsalo exactamente como brand.accent)` : `- Color de marca: no hay; elige un brand.accent (hex) que encaje con el rubro y los productos, sin el azul genérico.\n${paletteHint([ctx.businessName, ctx.description, ctx.purpose, ctx.designPrompt, ...ctx.products.map((p) => p.name)].filter(Boolean).join(". "))}`}
${ctx.salesContext ? `\nCONTEXTO REAL DE VENTAS (dudas de sus clientes)\n${ctx.salesContext}\n` : ""}
CATÁLOGO (productos reales; la plantilla muestra sus fotos y precios sola):
${productsBlock(ctx.products)}`;
}

function normalize(content: TemplateSiteContent, ctx: { businessName: string; products: CatalogProduct[]; brandColor?: string | null }): TemplateSiteContent {
  const ids = new Set(ctx.products.map((p) => p.id));
  const items = (content.items as { productId: string }[]).filter((i) => ids.has(i.productId));
  const brand = { name: content.brand.name?.trim() || ctx.businessName, accent: ctx.brandColor && /^#[0-9a-fA-F]{6}$/.test(ctx.brandColor) ? ctx.brandColor : content.brand.accent };
  const ticker = content.ticker.map((t) => t.trim()).filter(Boolean).slice(0, 6);
  if (content.template === "showroom") {
    const fallbackTicker = content.services.cards.map((c) => c.title).filter(Boolean).slice(0, 4);
    return { ...content, brand, items: items as typeof content.items, ticker: ticker.length ? ticker : fallbackTicker };
  }
  const fallbackTicker = content.hero.trust.map((t) => t.text).filter(Boolean).slice(0, 4);
  return { ...content, brand, items: items as typeof content.items, ticker: ticker.length ? ticker : fallbackTicker };
}

export async function generateTemplateSite(ctx: TemplateGenContext): Promise<TemplateSiteContent> {
  const schema = ctx.template === "showroom" ? ShowroomSchema : StorySchema;
  const prompt = `${ROLE}

${businessBlock(ctx)}

${ctx.template === "showroom" ? SHOWROOM_GUIDE : STORY_GUIDE}

${TRUTH}

Antes de responder, revisa: ¿el titular solo podría ser de este negocio? ¿algún dato no está en lo que te di? ¿algún texto suena a relleno de IA? Corrige lo que falle. Los campos version y template deben ser ${JSON.stringify(3)} y ${JSON.stringify(ctx.template)}.`;
  const parsed = await generateJson(schema, prompt);
  return normalize({ ...parsed, version: 3, template: ctx.template } as TemplateSiteContent, { businessName: ctx.businessName, products: ctx.products, brandColor: ctx.brandColors?.primary });
}

/** A chat edit on an existing template page ("cambia el titular", "agrega una oferta", "quita la cuenta regresiva"). */
export async function applyTemplateEdit(current: TemplateSiteContent, instruction: string, ctx: { businessName: string; products: CatalogProduct[]; brandColor?: string | null }): Promise<TemplateSiteContent> {
  const schema = current.template === "showroom" ? ShowroomSchema : StorySchema;
  const prompt = `${ROLE}

Aquí está el contenido actual de la página (JSON):
${JSON.stringify(current)}

CATÁLOGO (ids válidos para productId):
${productsBlock(ctx.products)}

El dueño del negocio pidió este cambio: "${instruction}"

Devuelve la página COMPLETA en el mismo formato aplicando ese cambio. Todo lo que no tenga que ver con el pedido queda EXACTAMENTE igual: no reescribas texto que no te pidieron. No cambies version ni template.
${current.template === "showroom" ? SHOWROOM_GUIDE : STORY_GUIDE}

${TRUTH}`;
  const parsed = await generateJson(schema, prompt);
  return normalize({ ...parsed, version: 3, template: current.template } as TemplateSiteContent, ctx);
}

export { TemplateSiteSchema };
