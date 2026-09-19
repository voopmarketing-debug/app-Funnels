import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
);

// Per-niche direction so every generated site doesn't converge on the same
// generic AI look — a clinic and a real-estate agency shouldn't read as the
// same template with different words swapped in.
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

export type WebsiteBusinessContext = {
  businessName: string;
  industry: string;
  description: string; // drawn from the AI agent's own system prompt
  whatsappNumber: string; // digits only, used to build a wa.me link
  city?: string | null;
  country?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
};

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*\n([\s\S]*?)\n```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Asks Claude to write one complete, self-contained marketing site for a
 * business — real content (no lorem ipsum), a niche-appropriate visual
 * direction instead of a generic AI-design default, and the business's real
 * WhatsApp number as the main call to action, since that's how a visitor
 * becomes a lead in this business's CRM (see handleIncomingMessage in
 * lib/agent.ts). Runs rarely (on demand, not per chat message) so this uses
 * full reasoning effort and a large output budget, unlike the low-effort
 * chat replies in lib/ai.ts.
 */
export async function generateWebsiteHtml(ctx: WebsiteBusinessContext): Promise<string> {
  const industryLabel = INDUSTRY_LABELS[ctx.industry] ?? INDUSTRY_LABELS.otro;
  const direction = INDUSTRY_DIRECTION[ctx.industry] ?? INDUSTRY_DIRECTION.otro;
  const waLink = `https://wa.me/${ctx.whatsappNumber.replace(/[^0-9]/g, "")}`;
  const location = [ctx.city, ctx.country].filter(Boolean).join(", ");
  const socials = [
    ctx.instagram ? `Instagram: ${ctx.instagram}` : null,
    ctx.facebook ? `Facebook: ${ctx.facebook}` : null,
    ctx.tiktok ? `TikTok: ${ctx.tiktok}` : null,
  ]
    .filter((s): s is string => !!s)
    .join(", ");

  const prompt = `Eres un diseñador y desarrollador web senior. Escribe el HTML completo de una landing page de una sola página para este negocio real:

- Nombre: ${ctx.businessName}
- Rubro: ${industryLabel}
- Qué hace / a quién le sirve (úsalo como fuente real de contenido, no lo repitas literal, escribe copy propio a partir de esto): ${ctx.description || "Negocio local — usa el rubro para inferir servicios típicos y créalos de forma creíble."}
${location ? `- Ubicación: ${location}` : ""}
${socials ? `- Redes sociales: ${socials}` : ""}
- WhatsApp de contacto (el CTA principal del sitio debe llevar aquí): ${waLink}

DIRECCIÓN VISUAL PARA ESTE RUBRO: ${direction}

Requisitos obligatorios:
1. Responde ÚNICAMENTE con el HTML completo, empezando en "<!doctype html>" — sin explicaciones antes ni después, sin bloques de código markdown.
2. Documento único y autocontenido: <style> inline, puedes usar un <link> a Google Fonts (elige una pareja tipográfica real y deliberada, no la fuente por defecto de cualquier IA), sin JavaScript externo ni frameworks.
3. Contenido 100% real y específico a este negocio — nada de "Lorem ipsum" ni placeholders genéricos tipo "Servicio 1/2/3". Si falta un dato (precios, horarios), redáctalo de forma creíble para el rubro sin inventar cifras falsas engañosas.
4. Secciones: hero con propuesta de valor clara, servicios/productos concretos, sobre el negocio, una sección de confianza (testimonios marcados como ejemplo si no hay reales, o beneficios/garantías), y contacto — con al menos dos botones grandes hacia WhatsApp (${waLink}) como llamado a la acción principal, ya que así es como los visitantes se convierten en clientes.
5. Totalmente responsive (funciona bien desde el celular — la mayoría del tráfico de WhatsApp es móvil), con una paleta de color y tipografía elegidas a propósito para este rubro (no el look genérico de IA: nada de fondo crema con serif y acento terracota por defecto, nada de gradiente morado-azul plano).
6. Al final del <body>, agrega un footer pequeño y discreto: "Sitio creado con Funnels Labs" enlazando a https://funnelslabs.app.
7. Usa <meta name="viewport" content="width=device-width, initial-scale=1">, un <title> con el nombre del negocio, y buen contraste de texto.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return the website HTML");
  }

  return stripCodeFences(textBlock.text);
}
