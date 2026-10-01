import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { WebsiteContentSchema, type WebsiteContent, type VisibleSections } from "@/lib/websiteContent";
import { recordAnthropicUsage } from "@/lib/aiUsage";

// What the AI actually generates — everything in WebsiteContentSchema
// except visibleSections, which is business-owner UI state (see its
// comment in websiteContent.ts), not something worth spending output
// tokens asking the model to decide. generateWebsiteContent/applyWebsiteEdit
// merge a visibleSections value back in below before returning the full,
// storage-shaped WebsiteContent.
const AiWebsiteContentSchema = WebsiteContentSchema.omit({ visibleSections: true });
type AiWebsiteContent = ReturnType<typeof AiWebsiteContentSchema.parse>;

const ALL_SECTIONS_VISIBLE: VisibleSections = {
  offer: true,
  howItWorks: true,
  whyUs: true,
  objections: true,
  contact: true,
};

// The Anthropic SDK's structured-output parser throws its own error class
// (AnthropicError) when the model's response doesn't validate against the
// zod schema — a rich object, not a plain string. Thrown as-is across a
// Next.js Server Action boundary, that class doesn't always serialize
// cleanly back to the client; instead of the real message, the browser
// shows an opaque "Minified React error #441" with no way to tell what
// actually went wrong. Re-throwing as a plain Error here guarantees the
// real message reaches the caller either way.
async function parseWebsiteContent(prompt: string): Promise<AiWebsiteContent> {
  let response;
  try {
    response = await anthropic.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      output_config: { format: zodOutputFormat(AiWebsiteContentSchema), effort: "medium" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("generateWebsiteContent: Anthropic structured-output call failed:", err);
    throw new Error(err instanceof Error ? err.message : "Falló la generación del sitio con IA");
  }
  await recordAnthropicUsage("claude-sonnet-5", response.usage);

  if (!response.parsed_output) {
    throw new Error("Claude no devolvió el contenido del sitio");
  }
  return response.parsed_output;
}

export const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
);

// Per-niche direction so pages don't converge on the same generic AI look —
// a clinic and a real-estate agency shouldn't read as the same layout with
// different words swapped in. Exported so lib/websiteHeroImage.ts can reuse
// the same curated direction for its image prompt instead of duplicating it.
export const INDUSTRY_DIRECTION: Record<string, string> = {
  coaching: "Cálido, humano y aspiracional. Foco en la transformación concreta del cliente (el antes y el después), nunca corporativo ni frío.",
  clinica: "Limpio, sereno y confiable. Transmite rigor médico, higiene y trato cercano, sin parecer plantilla de hospital genérica.",
  saas: "Moderno, preciso y directo al beneficio. El visitante entiende qué hace el producto y para quién en 3 segundos.",
  ecommerce: "Visual y orientado a producto. Deseo inmediato, beneficios tangibles y compra sin fricción.",
  inmobiliaria: "Elegante, sobrio y aspiracional. Transmite solidez, exclusividad y seguridad en una decisión grande.",
  restaurante: "Apetitoso, sensorial y cálido. Que se sienta el sabor y el ambiente, y den ganas de ir o pedir ya.",
  agencia: "Seguro, audaz y orientado a resultados. Transmite criterio y experiencia sin sonar a promesa vacía.",
  otro: "Profesional, claro y con personalidad propia, adaptado a lo que el negocio realmente ofrece según su descripción.",
};

// Art direction the generator hands the model on top of INDUSTRY_DIRECTION:
// a concrete palette territory and font pairings from FONT_OPTIONS, so the
// model makes a deliberate choice instead of falling back to Inter + blue.
// Kept separate from INDUSTRY_DIRECTION because lib/websiteHeroImage.ts
// reuses that one for photos, where font names would just be noise.
const INDUSTRY_DESIGN_SYSTEM: Record<string, string> = {
  coaching: "Paleta: fondo claro con un matiz cálido sutil (no beige genérico), acento vivo con energía (coral profundo, verde bosque, azul petróleo o ciruela). Tipografías sugeridas: Fraunces + DM Sans, Bricolage Grotesque + Manrope, u Outfit + Nunito Sans.",
  clinica: "Paleta: fondo blanco roto frío o verde/azul muy pálido, acento sereno y con autoridad (verde salvia profundo, azul clínico, teal). Tipografías sugeridas: Plus Jakarta Sans + Plus Jakarta Sans, Lora + Nunito Sans, o Manrope + Inter.",
  saas: "Paleta: fondo muy claro neutro-frío o modo oscuro profundo tintado (no negro puro), un acento eléctrico pero legible (índigo, verde lima oscuro, naranja intenso). Tipografías sugeridas: Sora + DM Sans, Bricolage Grotesque + Inter, o Space Grotesk + Manrope.",
  ecommerce: "Paleta: fondo claro limpio que no compita con el producto, acento de compra con mucha presencia. Tipografías sugeridas: Outfit + DM Sans, Syne + Work Sans, o Plus Jakarta Sans + Inter.",
  inmobiliaria: "Paleta: tonos sobrios y profundos (verde botella, azul marino, grafito tintado) sobre fondo claro piedra o fondo oscuro elegante, acento dorado apagado o bronce solo si encaja. Tipografías sugeridas: Cormorant Garamond + Manrope, Playfair Display + DM Sans, o Fraunces + Plus Jakarta Sans.",
  restaurante: "Paleta: colores que abren el apetito según la cocina (rojo tomate, verde oliva, mostaza, vino), fondo crema claro o fondo oscuro cálido. Tipografías sugeridas: Fraunces + Work Sans, Playfair Display + Outfit, o Syne + DM Sans.",
  agencia: "Paleta: contraste fuerte y con carácter, fondo oscuro tintado o claro muy limpio, un acento audaz. Tipografías sugeridas: Syne + DM Sans, Bricolage Grotesque + Inter, o Sora + Manrope.",
  otro: "Paleta: elige según la personalidad real del negocio, con un solo acento memorable. Tipografías: una pareja con contraste claro entre títulos y texto (serif + sans, o una display con carácter + una sans legible).",
};

export type WebsiteGenerationContext = {
  businessName: string;
  industry: string;
  description: string; // drawn from the AI agent's own system prompt
  whatsappNumber: string;
  city?: string | null;
  country?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  // What THIS specific page is for — lets one business have several pages
  // with different goals (e.g. "que el visitante agende una demo" vs "dar
  // a conocer el negocio en general"), same as Funnels Labs' own funnel
  // (funnelslabs.app + a dedicated agenda page). Null/empty = general site.
  purpose?: string | null;
  // The client's own free-text brief for how they want the page to look
  // and read — written in the "Nueva página" dialog (see
  // WebsitePagesList.tsx), stored on Website.designPrompt so "Regenerar
  // todo con IA" reuses it. Given priority over the generic per-industry
  // direction below when the two would conflict. Null/empty when the
  // client skipped it — the generic direction still produces a real page.
  designPrompt?: string | null;
  // When the page's goal is to send visitors somewhere other than
  // WhatsApp (e.g. a booking/agenda link) — becomes hero.ctaUrl.
  ctaUrl?: string | null;
  // Cheap, pre-summarized signal about what this business's real customers
  // actually ask/hesitate about — either the existing sales-diagnosis
  // report (see lib/diagnosis.ts, already computed from real transcripts,
  // reused here for free) or a small sample of recent customer messages.
  // Feeds the "objections" block specifically. Null when neither exists
  // yet (brand new business) — the model falls back to industry-typical
  // objections in that case.
  salesContext?: string | null;
};

/**
 * Asks Claude for structured, editable page content (not raw HTML) — real
 * copy, a niche-appropriate palette/typography instead of a generic AI
 * default, and the business's real WhatsApp number as the default call to
 * action (unless ctaUrl overrides it, e.g. for an agenda-focused page). The
 * structured result is rendered deterministically by lib/websiteTemplate.ts
 * and can be edited field-by-field afterward — see WebsiteEditor.
 *
 * Kept to exactly 6 content blocks (hero/offer/how it works/why us/
 * objections/contact — see WebsiteContentSchema). Runs at medium effort so
 * the model can work through the strategy step in the prompt (ideal client,
 * main objection, central idea) before writing; max_tokens leaves room for
 * that thinking on top of the structured output so it never truncates.
 * Generation is already rate-limited per business (websiteGenerationLimit).
 */
export async function generateWebsiteContent(ctx: WebsiteGenerationContext): Promise<WebsiteContent> {
  const industryLabel = INDUSTRY_LABELS[ctx.industry] ?? INDUSTRY_LABELS.otro;
  const direction = INDUSTRY_DIRECTION[ctx.industry] ?? INDUSTRY_DIRECTION.otro;
  const location = [ctx.city, ctx.country].filter(Boolean).join(", ");
  const socials = [
    ctx.instagram ? `Instagram: ${ctx.instagram}` : null,
    ctx.facebook ? `Facebook: ${ctx.facebook}` : null,
    ctx.tiktok ? `TikTok: ${ctx.tiktok}` : null,
  ]
    .filter((s): s is string => !!s)
    .join(", ");

  const designSystem = INDUSTRY_DESIGN_SYSTEM[ctx.industry] ?? INDUSTRY_DESIGN_SYSTEM.otro;

  const prompt = `Actúas como el director creativo y el copywriter de conversión de la mejor agencia de diseño web con IA del mundo: sitios con el nivel visual de un ganador de Awwwards y el copy de un especialista en respuesta directa que vende. Tu trabajo es crear la landing page de este negocio real como si fuera el cliente más importante de la agencia.

DATOS DEL NEGOCIO
- Nombre: ${ctx.businessName}
- Rubro: ${industryLabel}
- Qué hace / a quién le sirve (fuente real de contenido; escribe copy propio a partir de esto, no lo copies literal): ${ctx.description || "Negocio local. Usa el rubro para inferir servicios típicos y preséntalos de forma creíble."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes sociales: ${socials}` : ""}
${ctx.purpose ? `- OBJETIVO ESPECÍFICO DE ESTA PÁGINA (todo el copy y el botón principal empujan hacia esto): ${ctx.purpose}` : "- Esta página es la presentación general del negocio y su objetivo es que el visitante escriba por WhatsApp."}
${ctx.salesContext ? `\n${ctx.salesContext}\n` : ""}
DIRECCIÓN DE ARTE PARA ESTE RUBRO
- Personalidad: ${direction}
- Sistema visual: ${designSystem}
${
  ctx.designPrompt
    ? `\nBRIEF DEL CLIENTE PARA ESTA PÁGINA (tiene prioridad sobre la dirección de arte cuando haya conflicto, es lo que el cliente pidió explícitamente): "${ctx.designPrompt}"\n`
    : ""
}
ANTES DE ESCRIBIR, piensa como estratega (no lo incluyas en la respuesta):
1. ¿Quién es el cliente ideal exacto y qué situación lo trae a esta página?
2. ¿Qué resultado concreto quiere y qué miedo o duda lo frena?
3. ¿Cuál es la idea central que hace a este negocio distinto? Todo el sitio gira alrededor de esa idea.

ESTÁNDAR DE COPY
- Hero, heading: la promesa principal en máximo 10 palabras. Resultado concreto para un público concreto, con un detalle que solo este negocio podría decir. Nada de preguntas retóricas, nada de repetir el nombre del negocio, nada de titulares que sirvan para cualquier empresa del rubro.
- Hero, subheading: 1 o 2 frases (máximo 30 palabras) que digan qué ofreces, a quién y cómo, y quiten la primera duda.
- Hero, ctaLabel: 2 a 5 palabras, empieza con verbo, de baja fricción y alineado al objetivo de la página (ej. "Escríbenos por WhatsApp", "Agenda tu valoración", "Pide tu cotización").
- Títulos de sección (offer, howItWorks, whyUs, objections, contact): cada uno comunica un beneficio o una idea, no una etiqueta. La página ya muestra etiquetas como "Lo que ofrecemos" o "Cómo funciona" encima, así que el título NUNCA repite esa etiqueta.
- offer: servicios o productos reales. Título de 2 a 5 palabras; descripción de máximo 25 palabras con el resultado para el cliente y un detalle concreto (qué incluye, para quién, en cuánto tiempo), sin inventar precios.
- howItWorks: el camino real y sin fricción desde "me interesa" hasta "ya soy cliente". El primer paso coincide con el botón principal. Título corto tipo verbo; descripción de una frase que quite miedo.
- whyUs: diferenciadores concretos y verificables. Nunca "calidad", "confianza", "compromiso", "atención personalizada" ni "años de experiencia" a menos que sea un dato real dado arriba; si no hay datos duros, usa diferencias de método, enfoque o garantía de proceso.
- objections (el bloque más importante): usa el contexto de conversaciones reales (si lo hay) para detectar 2 a 4 dudas que DE VERDAD frenan la venta (precio, tiempo, confianza, si funciona para mi caso, qué pasa si no me gusta). Escribe la pregunta como la diría el cliente, en primera persona. La respuesta empieza respondiendo directo (sí, no, depende de X) y luego da la razón, en máximo 40 palabras. Nada de preguntas genéricas tipo "¿cómo los contacto?".
- contact: título que invite a dar el paso hoy y un body de una frase que reduzca el riesgo de escribir (respuesta rápida, sin compromiso, etc.), sin urgencia falsa ni escasez inventada.
- Voz: como hablaría el mejor vendedor del negocio. Frases cortas, verbos activos, concreto. Tutea salvo que el rubro y el público pidan "usted" (ej. inmobiliaria de lujo o clínica con público mayor); sé consistente en toda la página.
- Prohibido: "revoluciona", "desbloquea", "potencia", "lleva tu negocio al siguiente nivel", "en la era digital", "transforma tu vida", "soluciones integrales", "de calidad", "tu mejor opción", signos de exclamación en exceso, emojis y guion largo (—). Usa punto o coma.
- Nunca inventes cifras, premios, clientes, reseñas, años de experiencia ni certificaciones que no estén en los datos.

ESTÁNDAR VISUAL (theme)
- Elige una paleta como directora de arte, coherente con la dirección de arte de arriba. Nada del look genérico de IA: sin azul #1f6feb por defecto, sin degradado morado/azul, sin el combo "beige cálido + terracota", sin negro lima neón.
- backgroundColor: nunca #ffffff ni #000000 puros. Si es claro, un blanco roto con un matiz sutil hacia el acento; si es oscuro, un tono profundo tintado.
- textColor: casi negro (o casi blanco en fondo oscuro) tintado del mismo matiz; contraste de al menos 7:1 contra el fondo.
- primaryColor: un solo acento con intención. Se usa en botones y en textos pequeños sobre el fondo, así que debe tener contraste de al menos 4.5:1 contra backgroundColor. Nada de pasteles sobre fondo claro ni tonos apagados sobre fondo oscuro.
- headingFont y bodyFont: una pareja con contraste intencional (serif editorial + sans limpia, o display con carácter + sans legible), preferiblemente de las sugeridas para el rubro. Inter o Poppins solo si de verdad es la mejor elección, no por defecto.

REGLAS FINALES
- Contenido 100% real y específico a este negocio, nada de "Lorem ipsum" ni placeholders. Si falta un dato (precios, horarios), redacta sin él en vez de inventarlo.
- videoUrl: siempre null.
- Antes de responder, revisa: ¿el titular solo podría ser de este negocio? ¿Cada sección tiene un dato concreto? ¿Hay alguna frase de relleno que un director creativo tacharía? Corrige lo que falle.`;

  const content = await parseWebsiteContent(prompt);
  // ctaUrl is caller-controlled (e.g. an agenda link), not something the
  // model should invent — only fill it in when the caller actually gave one.
  if (ctx.ctaUrl) content.hero.ctaUrl = ctx.ctaUrl;

  // New page: every section starts visible — the owner turns any off later
  // from the editor if this business doesn't need it (see visibleSections'
  // own comment in websiteContent.ts for why the AI never decides this).
  return { ...content, visibleSections: ALL_SECTIONS_VISIBLE };
}

/**
 * Applies a free-text instruction to an already-generated page — the
 * "Lovable-style" prompt box in the website editor. Claude sees the current
 * structured content as-is and returns the whole thing back, changed only
 * where the instruction asked for it; everything else must come back
 * untouched, which is why the current content is handed over as data
 * instead of just describing the page in prose.
 */
export async function applyWebsiteEdit(currentContent: WebsiteContent, instruction: string): Promise<WebsiteContent> {
  const prompt = `Aquí está el contenido actual de una página web, en JSON:

${JSON.stringify(currentContent, null, 2)}

El dueño del negocio pidió este cambio: "${instruction}"

Actúa como el director creativo de la mejor agencia de diseño web con IA del mundo. Devuelve el contenido COMPLETO de la página (mismo formato) aplicando ese cambio. Todo lo que no tenga que ver con el pedido debe quedar EXACTAMENTE igual: no reescribas ni "mejores" texto que no te pidieron cambiar.

Lo que sí cambies debe tener nivel de agencia premium:
- Copy concreto y específico del negocio, frases cortas, sin relleno tipo IA ("revoluciona", "desbloquea", "siguiente nivel", "soluciones integrales"), sin emojis y sin guion largo (—); usa punto o coma. No inventes cifras, reseñas ni premios.
- Si cambias colores: backgroundColor nunca #ffffff ni #000000 puros, textColor con contraste de al menos 7:1 sobre el fondo, primaryColor con contraste de al menos 4.5:1 sobre el fondo.
- Si cambias tipografías: una pareja con contraste intencional entre títulos y texto.`;

  const updated = await parseWebsiteContent(prompt);
  // Which sections are on/off is the owner's own toggle choice (see
  // visibleSections' comment in websiteContent.ts) — a free-text AI edit
  // never touches it, so it survives exactly as it was before this edit.
  return { ...updated, visibleSections: currentContent.visibleSections };
}
