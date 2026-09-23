import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { WebsiteContentSchema, type WebsiteContent } from "@/lib/websiteContent";

// The Anthropic SDK's structured-output parser throws its own error class
// (AnthropicError) when the model's response doesn't validate against the
// zod schema — a rich object, not a plain string. Thrown as-is across a
// Next.js Server Action boundary, that class doesn't always serialize
// cleanly back to the client; instead of the real message, the browser
// shows an opaque "Minified React error #441" with no way to tell what
// actually went wrong. Re-throwing as a plain Error here guarantees the
// real message reaches the caller either way.
async function parseWebsiteContent(prompt: string): Promise<WebsiteContent> {
  let response;
  try {
    response = await anthropic.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 2200,
      output_config: { format: zodOutputFormat(WebsiteContentSchema), effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("generateWebsiteContent: Anthropic structured-output call failed:", err);
    throw new Error(err instanceof Error ? err.message : "Falló la generación del sitio con IA");
  }

  if (!response.parsed_output) {
    throw new Error("Claude no devolvió el contenido del sitio");
  }
  return response.parsed_output;
}

const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
);

// Per-niche direction so pages don't converge on the same generic AI look —
// a clinic and a real-estate agency shouldn't read as the same layout with
// different words swapped in.
const INDUSTRY_DIRECTION: Record<string, string> = {
  coaching: "Cálido y aspiracional, con foco en la transformación del cliente y prueba social — no corporativo ni frío.",
  clinica: "Limpio, confiable y calmado — transmite higiene y profesionalismo médico sin sentirse una web genérica de plantilla.",
  saas: "Moderno y directo al beneficio del producto, con jerarquía visual clara — el visitante entiende qué hace el producto en 3 segundos.",
  ecommerce: "Visual y orientado a producto, con llamados a la acción de compra claros — foco en mostrar catálogo/oferta.",
  inmobiliaria: "Elegante y aspiracional, con foco en propiedades/ubicación y confianza — transmite solidez.",
  restaurante: "Apetitoso y cálido, con foco en el menú/ambiente — que dé ganas de ir o pedir ya.",
  agencia: "Seguro y orientado a resultados, con foco en casos/servicios — transmite expertise sin sonar genérico.",
  otro: "Profesional y claro, adaptado a lo que el negocio realmente ofrece según su descripción.",
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
 * Kept to exactly 4 content blocks (hero/offer/objections/contact — see
 * WebsiteContentSchema) and run at low reasoning effort with a smaller
 * output budget than a general-purpose generation call would use: this is
 * "write focused copy from given inputs," not open-ended reasoning, and it
 * runs on every "Generar sitio web" click, so cost matters.
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

  const prompt = `Eres un copywriter y diseñador web senior. Genera el contenido de una landing page de 4 bloques (hero, oferta, objeciones, contacto) para este negocio real:

- Nombre: ${ctx.businessName}
- Rubro: ${industryLabel}
- Qué hace / a quién le sirve (fuente real de contenido — escribe copy propio a partir de esto, no lo repitas literal): ${ctx.description || "Negocio local — usa el rubro para inferir servicios típicos y créalos de forma creíble."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes sociales: ${socials}` : ""}
${ctx.purpose ? `- OBJETIVO ESPECÍFICO DE ESTA PÁGINA (ajusta el copy y el botón principal a esto): ${ctx.purpose}` : "- Esta página es la presentación general del negocio."}
${ctx.salesContext ? `\n${ctx.salesContext}\n` : ""}

DIRECCIÓN VISUAL PARA ESTE RUBRO: ${direction}

Reglas:
1. Contenido 100% real y específico a este negocio — nada de "Lorem ipsum" ni placeholders genéricos. Si falta un dato (precios, horarios), redáctalo de forma creíble sin inventar cifras falsas.
2. Colores (hex) y tipografías elegidos a propósito para este rubro — nada del look genérico de IA. Buen contraste entre textColor y backgroundColor.
3. El bloque "objections" es el más importante: usa el contexto de conversaciones reales dado arriba (si lo hay) para identificar 2-4 dudas u objeciones DE VERDAD que frenan la venta de este negocio, y respóndelas de forma directa y convincente — no pongas preguntas frecuentes genéricas tipo "¿cómo los contacto?". Si no hay contexto de conversaciones, infiere las objeciones típicas más realistas para este rubro específico.
4. videoUrl: siempre null — no gastes esfuerzo en esto, el cliente lo agrega después si quiere.
5. El botón principal (hero.ctaLabel) y el texto de contacto deben reflejar el objetivo específico de la página si se dio uno arriba.`;

  const content = await parseWebsiteContent(prompt);
  // ctaUrl is caller-controlled (e.g. an agenda link), not something the
  // model should invent — only fill it in when the caller actually gave one.
  if (ctx.ctaUrl) content.hero.ctaUrl = ctx.ctaUrl;

  return content;
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

Devuelve el contenido COMPLETO de la página (mismo formato) aplicando ese cambio. Todo lo que no tenga que ver con el pedido debe quedar EXACTAMENTE igual — no reescribas ni "mejores" texto que no te pidieron cambiar.`;

  return parseWebsiteContent(prompt);
}
