import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { WebsiteContentSchema, type WebsiteContent } from "@/lib/websiteContent";

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
};

/**
 * Asks Claude for structured, editable page content (not raw HTML) — real
 * copy, a niche-appropriate palette/typography instead of a generic AI
 * default, and the business's real WhatsApp number as the default call to
 * action (unless ctaUrl overrides it, e.g. for an agenda-focused page). The
 * structured result is rendered deterministically by lib/websiteTemplate.ts
 * and can be edited field-by-field afterward — see WebsiteEditor.
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

  const prompt = `Eres un copywriter y diseñador web senior. Genera el contenido estructurado de una página de una sola sección (landing page) para este negocio real:

- Nombre: ${ctx.businessName}
- Rubro: ${industryLabel}
- Qué hace / a quién le sirve (fuente real de contenido — escribe copy propio a partir de esto, no lo repitas literal): ${ctx.description || "Negocio local — usa el rubro para inferir servicios típicos y créalos de forma creíble."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes sociales: ${socials}` : ""}
${ctx.purpose ? `- OBJETIVO ESPECÍFICO DE ESTA PÁGINA (muy importante, ajusta el copy y el botón principal a esto): ${ctx.purpose}` : "- Esta página es la presentación general del negocio."}

DIRECCIÓN VISUAL PARA ESTE RUBRO: ${direction}

Reglas:
1. Contenido 100% real y específico a este negocio — nada de "Lorem ipsum" ni placeholders genéricos tipo "Servicio 1/2/3". Si falta un dato (precios, horarios), redáctalo de forma creíble para el rubro sin inventar cifras falsas.
2. Elige colores (hex) y tipografías a propósito para este rubro — nada del look genérico de IA (nada de fondo crema con serif y acento terracota por defecto, nada de gradiente morado-azul plano). Asegura buen contraste entre textColor y backgroundColor.
3. Entre 3 y 6 servicios/productos concretos.
4. 0 a 3 testimonios — si no hay reales, márcalos como ejemplo en el nombre del autor, ej. "(ejemplo)".
5. videoUrl: solo si tiene sentido para este rubro dejarlo listo para un video institucional/demo (ponlo en null si no aplica — el cliente puede agregarlo después desde su panel).
6. El botón principal (hero.ctaLabel) y el texto de contacto deben reflejar el objetivo específico de la página si se dio uno arriba.`;

  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(WebsiteContentSchema) },
    messages: [{ role: "user", content: prompt }],
  });

  if (!response.parsed_output) {
    throw new Error("Claude no devolvió el contenido del sitio");
  }

  const content = response.parsed_output;
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

  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(WebsiteContentSchema) },
    messages: [{ role: "user", content: prompt }],
  });

  if (!response.parsed_output) {
    throw new Error("Claude no devolvió el contenido actualizado");
  }

  return response.parsed_output;
}
