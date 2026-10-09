import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { recordAnthropicUsage } from "@/lib/aiUsage";
import type { SocialDashboard } from "@/lib/socialDashboard";
import type { SocialPost } from "@/lib/metaSocial";

// Reads the business's real Facebook/Instagram posts and their numbers and
// says what kind of content works for THIS audience, then proposes posts
// built on that. Grounded in the data on purpose: generic social-media tips
// are free anywhere, the value is "your carousels about X get 3x the rest".

/** Fewer posts than this and any "pattern" would be noise. */
export const MIN_POSTS = 4;
const MAX_POSTS = 40;

const ContentIdeaSchema = z.object({
  titulo: z.string().describe("Nombre corto de la idea, ej. 'Antes y después de un blanqueamiento'."),
  red: z.enum(["Instagram", "Facebook", "Ambas"]).describe("Dónde publicarla, según dónde funcionó mejor ese tipo de contenido."),
  formato: z.enum(["Reel", "Carrusel", "Foto", "Video", "Historia", "Texto"]),
  gancho: z.string().describe("La primera frase o los primeros 3 segundos: lo que hace que la persona se detenga."),
  desarrollo: z.string().describe("Qué mostrar o decir, en 2-4 frases concretas que alguien sin experiencia pueda grabar o diseñar."),
  texto: z.string().describe("Texto listo para pegar en la publicación, con emojis moderados y un llamado a escribir por WhatsApp."),
  porque: z.string().describe("Por qué debería funcionar, citando el dato o la publicación real en que se basa."),
});

const ContentDiagnosisSchema = z.object({
  resumen: z.string().describe("2-3 frases para el dueño del negocio sobre cómo le está yendo con su contenido."),
  puntuacion: z.number().int().min(1).max(10).describe("De 1 a 10, qué tan bien está funcionando el contenido para atraer y mantener a su audiencia."),
  funciona: z.array(z.string()).min(1).max(5).describe("Patrones concretos de lo que mejor funciona, citando publicaciones o cifras reales."),
  noFunciona: z.array(z.string()).min(1).max(5).describe("Patrones concretos de lo que no está funcionando, con datos."),
  recomendaciones: z.array(z.string()).min(1).max(5).describe("Acciones concretas en orden de impacto. La primera es la más importante."),
  cuandoPublicar: z.string().describe("Qué días y horarios dieron mejores resultados, o qué probar si no hay datos suficientes."),
  ideas: z.array(ContentIdeaSchema).min(3).max(6).describe("Ideas de publicaciones nuevas basadas en lo que ya funciona para este negocio."),
});

export type ContentDiagnosis = z.infer<typeof ContentDiagnosisSchema>;
export type ContentIdea = z.infer<typeof ContentIdeaSchema>;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function describePost(p: SocialPost, i: number): string {
  // Colombia time (no DST), so "martes 7 p. m." means what the owner thinks it means.
  const d = new Date(Date.parse(p.publishedAt) - 5 * 3_600_000);
  const rate = p.views ? ` (${((p.interactions / p.views) * 100).toFixed(1)}% de interacción)` : "";
  const text = p.text.replace(/\s+/g, " ").trim().slice(0, 280) || "(sin texto)";
  return `${i + 1}. [${p.network === "facebook" ? "Facebook" : "Instagram"} · ${p.type} · ${WEEKDAYS[d.getUTCDay()]} ${d.getUTCHours()}:00 · ${d.toISOString().slice(0, 10)}] visualizaciones: ${p.views ?? "sin dato"} · interacciones: ${p.interactions}${rate}\n   "${text}"`;
}

function describeAccount(data: SocialDashboard): string {
  const lines: string[] = [];
  for (const network of ["facebook", "instagram"] as const) {
    const r = data[network];
    if (!r?.ok) continue;
    const n = r.data;
    lines.push(
      `${network === "facebook" ? "Facebook" : "Instagram"}: ${n.followers ?? "?"} seguidores (${n.followersDelta == null ? "sin dato de cambio" : `${n.followersDelta >= 0 ? "+" : ""}${n.followersDelta} en el período`}), ${n.views ?? "?"} visualizaciones (período anterior: ${n.viewsPrev ?? "?"}), ${n.engagement ?? "?"} interacciones (período anterior: ${n.engagementPrev ?? "?"}).`,
    );
  }
  return lines.join("\n") || "Sin datos de cuenta.";
}

const SYSTEM_PROMPT = `Eres estratega de contenido para redes sociales de pequeños negocios en Latinoamérica, experto en Instagram y Facebook orgánico.

Recibes las publicaciones reales de un negocio con sus números. Tu trabajo:
1. Encontrar qué tipo de contenido le funciona A ESTE negocio (temas, formatos, ganchos, días y horas) y qué no, comparando publicaciones entre sí. Cita publicaciones y cifras reales; nunca des consejos genéricos que servirían para cualquier cuenta.
2. Proponer publicaciones nuevas que repitan lo que ya funcionó, adaptadas a lo que vende el negocio, listas para hacer hoy con un celular.

Reglas:
- Escribe para el dueño del negocio, que no es experto: frases cortas, sin jerga ("engagement" → "interacción", "CTA" → "invitación a escribir").
- Trata a la persona de "tú".
- La interacción importa más que las visualizaciones: una publicación vista por pocos pero con muchas interacciones indica un tema que conecta.
- Si hay pocas publicaciones o los números son bajos, dilo con honestidad y basa las ideas en lo poco que sí funcionó y en lo que vende el negocio.
- Los textos propuestos invitan a escribir por WhatsApp, que es donde el negocio vende. Nada de hashtags en exceso (máximo 3-5).`;

export async function generateContentDiagnosis(
  businessId: string,
  data: SocialDashboard,
): Promise<{ status: "insufficient_data"; posts: number } | { status: "ok"; diagnosis: ContentDiagnosis }> {
  const posts = data.posts?.ok ? data.posts.data : [];
  if (posts.length < MIN_POSTS) return { status: "insufficient_data", posts: posts.length };

  const [business, products] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, industry: true } }),
    prisma.product.findMany({ where: { businessId, active: true }, orderBy: { createdAt: "asc" }, take: 15, select: { name: true, kind: true } }),
  ]);
  const industry = INDUSTRY_OPTIONS.find((o) => o.value === business.industry)?.label ?? "otro";
  const catalog = products.length
    ? products.map((p) => `${p.name}${p.kind === "SERVICE" ? " (servicio)" : ""}`).join(", ")
    : "No tiene catálogo cargado; deduce lo que vende de sus publicaciones.";

  // Best first, so the strongest examples are what the model reads first.
  const sample = [...posts].sort((a, b) => b.interactions - a.interactions).slice(0, MAX_POSTS);

  const response = await anthropic.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(ContentDiagnosisSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `Negocio: ${business.name} (rubro: ${industry}).
Lo que vende: ${catalog}
Período analizado: ${data.range.since} a ${data.range.until}.

Cuenta:
${describeAccount(data)}

${sample.length} publicaciones del período, ordenadas de más a menos interacciones:
${sample.map(describePost).join("\n")}

Haz el diagnóstico del contenido y propone las ideas.`,
      },
    ],
  });
  await recordAnthropicUsage("claude-opus-5-5", response.usage);

  if (!response.parsed_output) throw new Error("Claude no devolvió un diagnóstico válido");
  return { status: "ok", diagnosis: response.parsed_output };
}
