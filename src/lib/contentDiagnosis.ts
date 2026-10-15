import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { recordAnthropicUsage } from "@/lib/aiUsage";
import type { AdsWithPrevious, SocialDashboard } from "@/lib/socialDashboard";
import { cpm, frequency, linkCtr, objectiveLabel, type DayRange, type SocialPost } from "@/lib/metaSocial";
import { adviseCampaign, campaignOutcome, VERDICT_LABELS } from "@/lib/adsAdvice";

// Reads the business's real Facebook/Instagram posts and their numbers and
// says what kind of content works for THIS audience, then proposes posts
// built on that. When the business runs ads, the same report says what to
// change in each campaign and proposes new ads. Grounded in the data on purpose: generic social-media tips
// are free anywhere, the value is "your carousels about X get 3x the rest".

/** Fewer posts than this and any "pattern" would be noise. */
export const MIN_POSTS = 4;
const MAX_POSTS = 40;
const MAX_CAMPAIGNS = 25;

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

const AdImprovementSchema = z.object({
  campana: z.string().describe("Nombre exacto de la campaña, o 'Toda la cuenta' si aplica a todas."),
  accion: z.string().describe("Qué hacer, en una frase que empieza con un verbo: 'Apágala', 'Cambia el video', 'Súbele 20% el presupuesto'…"),
  porque: z.string().describe("Por qué, citando sus números reales (inversión, conversaciones, costo de cada una) en palabras simples."),
});

const AdIdeaSchema = z.object({
  titulo: z.string().describe("Nombre corto del anuncio, ej. 'Promo de blanqueamiento con testimonio'."),
  formato: z.enum(["Video", "Reel", "Imagen", "Carrusel"]),
  gancho: z.string().describe("La primera frase o los primeros 3 segundos, lo que hace que la persona se detenga."),
  texto: z.string().describe("Texto del anuncio listo para pegar, que invita a escribir por WhatsApp."),
  publico: z.string().describe("A quién mostrárselo, en palabras simples (edad, zona, intereses)."),
  porque: z.string().describe("Por qué debería funcionar, basado en la campaña o publicación real que mejor rindió."),
});

const AdsDiagnosisSchema = z.object({
  resumen: z.string().describe("2-3 frases para el dueño sobre si sus anuncios le están trayendo clientes a buen precio."),
  puntuacion: z.number().int().min(1).max(10).describe("De 1 a 10, qué tan bien están rindiendo sus anuncios para lo que invierte."),
  mejoras: z.array(AdImprovementSchema).min(1).max(5).describe("Cambios concretos por campaña, en orden de impacto. La primera es la más importante."),
  presupuesto: z.string().describe("Dónde poner el dinero de ahora en adelante: qué apagar, qué subir y cuánto, en 2-3 frases."),
  ideas: z.array(AdIdeaSchema).min(2).max(3).describe("Anuncios nuevos para probar, basados en lo que ya funcionó."),
});

const DiagnosisSchema = ContentDiagnosisSchema.extend({
  anuncios: AdsDiagnosisSchema.nullable().describe("El diagnóstico de los anuncios. null si no se te dieron datos de anuncios."),
});

export type ContentDiagnosis = z.infer<typeof ContentDiagnosisSchema> & {
  /** Missing in reports made before ads were included. */
  anuncios?: AdsDiagnosis | null;
};
export type AdsDiagnosis = z.infer<typeof AdsDiagnosisSchema>;
export type AdIdea = z.infer<typeof AdIdeaSchema>;
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

export type AdsInput = { range: DayRange; data: AdsWithPrevious };

/** The ads, as the model reads them: totals, then each campaign with what it got and what our rules already see. */
function describeAds({ range, data }: AdsInput): string {
  const t = data.totals;
  const money = (n: number | null) => (n == null ? "sin dato" : `${Math.round(n).toLocaleString("es-CO")} ${data.currency}`);
  const totalLine = `Toda la cuenta (${range.since} a ${range.until}): invirtió ${money(t.spend)}, ${t.conversations ?? 0} conversaciones por WhatsApp/Messenger${
    t.conversations ? ` (${money(t.spend / t.conversations)} cada una)` : ""
  }, ${t.linkClicks ?? 0} clics al enlace, ${t.reach} personas alcanzadas, frecuencia ${frequency(t)?.toFixed(1) ?? "?"}, CPM ${money(cpm(t))}. Período anterior: invirtió ${money(data.previous.spend)}, ${data.previous.conversations ?? 0} conversaciones.`;
  const campaigns = [...data.campaigns].sort((a, b) => b.spend - a.spend).slice(0, MAX_CAMPAIGNS);
  const lines = campaigns.map((c, i) => {
    const o = campaignOutcome(c);
    const advice = adviseCampaign(c, data.campaigns, t);
    const ctr = linkCtr(c);
    return `${i + 1}. «${c.name}» [${c.status ?? "estado desconocido"} · objetivo: ${objectiveLabel(c.objective)}] invirtió ${money(c.spend)} → ${o.count ?? "sin dato"} ${o.plural}${
      o.cost != null ? ` (${o.costLabel.toLowerCase()} ${money(o.cost)})` : ""
    }; CTR enlace ${ctr == null ? "?" : `${ctr.toFixed(2)}%`}; frecuencia ${frequency(c)?.toFixed(1) ?? "?"}; CPM ${money(cpm(c))}. Nuestra regla dice: ${VERDICT_LABELS[advice.verdict]} (${advice.tips.map((x) => x.text).join(" ")})`;
  });
  return `${totalLine}\n${lines.join("\n") || "Ninguna campaña con gasto."}`;
}

const SYSTEM_PROMPT = `Eres estratega de redes sociales y de publicidad en Facebook e Instagram (Meta Ads) para pequeños negocios en Latinoamérica.

Recibes las publicaciones reales de un negocio con sus números. Tu trabajo:
1. Encontrar qué tipo de contenido le funciona A ESTE negocio (temas, formatos, ganchos, días y horas) y qué no, comparando publicaciones entre sí. Cita publicaciones y cifras reales; nunca des consejos genéricos que servirían para cualquier cuenta.
2. Proponer publicaciones nuevas que repitan lo que ya funcionó, adaptadas a lo que vende el negocio, listas para hacer hoy con un celular.

Reglas:
- Escribe para el dueño del negocio, que no es experto: frases cortas, sin jerga ("engagement" → "interacción", "CTA" → "invitación a escribir").
- Trata a la persona de "tú".
- La interacción importa más que las visualizaciones: una publicación vista por pocos pero con muchas interacciones indica un tema que conecta.
- Si hay pocas publicaciones o los números son bajos, dilo con honestidad y basa las ideas en lo poco que sí funcionó y en lo que vende el negocio.
- Los textos propuestos invitan a escribir por WhatsApp, que es donde el negocio vende. Nada de hashtags en exceso (máximo 3-5).

Si recibes datos de anuncios, haz también su diagnóstico (campo "anuncios"):
- Lo que importa es cuánto cuesta cada conversación o cliente, no los clics ni las impresiones. Compara campañas entre sí con sus números reales.
- Cada mejora nombra la campaña exacta y dice qué hacer: apagarla, cambiar el anuncio (imagen, video, primera frase), cambiar el público, o subir el presupuesto de a poco (20% cada 3-4 días).
- Una campaña apagada que funcionó bien es un modelo a repetir; una que gastó sin resultados no se repite.
- Las ideas de anuncios se basan en la campaña que mejor rindió y en las publicaciones con más interacción: lo que ya conectó de forma orgánica suele funcionar como anuncio.
- Sin datos de anuncios, "anuncios" es null.`;

export async function generateContentDiagnosis(
  businessId: string,
  data: SocialDashboard,
  ads: AdsInput | null = null,
): Promise<{ status: "insufficient_data"; posts: number } | { status: "ok"; diagnosis: ContentDiagnosis }> {
  const posts = data.posts?.ok ? data.posts.data : [];
  const hasAds = !!ads && ads.data.campaigns.some((c) => c.spend > 0);
  // With ads to look at, a few posts are still worth a report.
  if (posts.length < MIN_POSTS && !hasAds) return { status: "insufficient_data", posts: posts.length };

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
    output_config: { format: zodOutputFormat(DiagnosisSchema), effort: "high" },
    messages: [
      {
        role: "user",
        content: `Negocio: ${business.name} (rubro: ${industry}).
Lo que vende: ${catalog}
Período analizado: ${data.range.since} a ${data.range.until}.

Cuenta:
${describeAccount(data)}

${sample.length} publicaciones del período, ordenadas de más a menos interacciones${sample.length < MIN_POSTS ? " (son pocas: dilo y no saques patrones fuertes)" : ""}:
${sample.map(describePost).join("\n") || "(ninguna)"}

${hasAds ? `Anuncios (Meta Ads), campañas de la que más invirtió a la que menos:\n${describeAds(ads!)}` : "Sin datos de anuncios."}

Haz el diagnóstico del contenido${hasAds ? " y de los anuncios" : ""} y propone las ideas.`,
      },
    ],
  });
  await recordAnthropicUsage("claude-opus-5-5", response.usage);

  if (!response.parsed_output) throw new Error("Claude no devolvió un diagnóstico válido");
  return { status: "ok", diagnosis: response.parsed_output };
}
