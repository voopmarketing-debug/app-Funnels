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

/**
 * A business that sells 2 to 6 distinct products or services (e.g. the three
 * virtual products of a gym brand) gets its report split by product, so each
 * idea says which one it is for. Beyond that the list is a catalog, not a
 * handful of product lines, and the report stays whole.
 */
export const MAX_SPLIT_PRODUCTS = 6;

/** Fewer posts than this and any "pattern" would be noise. */
export const MIN_POSTS = 4;
const MAX_POSTS = 40;
const MAX_CAMPAIGNS = 25;

const PRODUCT_HINT = "Nombre EXACTO de uno de los productos de la lista, o 'General' si no es de un producto en particular. 'General' si no se te dio una lista de productos a dividir.";

const ContentIdeaSchema = z.object({
  producto: z.string().describe(PRODUCT_HINT),
  titulo: z.string().describe("Nombre corto de la idea, ej. 'Antes y después de un blanqueamiento'."),
  red: z.enum(["Instagram", "Facebook", "Ambas"]).describe("Dónde publicarla, según dónde funcionó mejor ese tipo de contenido."),
  formato: z.enum(["Reel", "Carrusel", "Foto", "Video", "Historia", "Texto"]),
  gancho: z.string().describe("La primera frase o los primeros 3 segundos: lo que hace que la persona se detenga."),
  desarrollo: z.string().describe("Qué mostrar o decir, en 2-4 frases concretas que alguien sin experiencia pueda grabar o diseñar."),
  texto: z.string().describe("Texto listo para pegar en la publicación, con emojis moderados y un llamado a escribir por WhatsApp."),
  porque: z.string().describe("Por qué debería funcionar, citando el dato o la publicación real en que se basa."),
});

const ProductDiagnosisSchema = z.object({
  nombre: z.string().describe("Nombre EXACTO del producto, tal como está en la lista."),
  publicaciones: z.number().int().min(0).describe("Cuántas de las publicaciones analizadas son de este producto (cuenta solo las que lo promueven o lo mencionan de verdad)."),
  estado: z.enum(["Bien trabajado", "Poco contenido", "Sin contenido"]).describe("Qué tanto contenido tiene hoy este producto frente a los demás y a su peso para el negocio."),
  resumen: z.string().describe("1-2 frases: qué se ha publicado de este producto y cómo le ha ido, citando publicaciones o cifras reales. Si no hay contenido, dilo."),
  proximo: z.string().describe("La acción de contenido más importante para este producto, concreta y en una frase que empieza con un verbo."),
});

const ContentDiagnosisSchema = z.object({
  resumen: z.string().describe("2-3 frases para el dueño del negocio sobre cómo le está yendo con su contenido."),
  puntuacion: z.number().int().min(1).max(10).describe("De 1 a 10, qué tan bien está funcionando el contenido para atraer y mantener a su audiencia."),
  funciona: z.array(z.string()).min(1).max(5).describe("Patrones concretos de lo que mejor funciona, citando publicaciones o cifras reales."),
  noFunciona: z.array(z.string()).min(1).max(5).describe("Patrones concretos de lo que no está funcionando, con datos."),
  recomendaciones: z.array(z.string()).min(1).max(5).describe("Acciones concretas en orden de impacto. La primera es la más importante."),
  cuandoPublicar: z.string().describe("Qué días y horarios dieron mejores resultados, o qué probar si no hay datos suficientes."),
  ideas: z.array(ContentIdeaSchema).min(3).max(12).describe("Ideas de publicaciones nuevas basadas en lo que ya funciona para este negocio. Con varios productos: 2 o 3 por cada uno."),
});

const AdImprovementSchema = z.object({
  campana: z.string().describe("Nombre exacto de la campaña, o 'Toda la cuenta' si aplica a todas."),
  accion: z.string().describe("Qué hacer, en una frase que empieza con un verbo: 'Apágala', 'Cambia el video', 'Súbele 20% el presupuesto'…"),
  porque: z.string().describe("Por qué, citando sus números reales (inversión, conversaciones, costo de cada una) en palabras simples."),
});

const AdIdeaSchema = z.object({
  producto: z.string().describe(PRODUCT_HINT),
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
  ideas: z.array(AdIdeaSchema).min(2).max(6).describe("Anuncios nuevos para probar, basados en lo que ya funcionó. Con varios productos: al menos 1 por cada uno."),
});

const DiagnosisSchema = ContentDiagnosisSchema.extend({
  productos: z.array(ProductDiagnosisSchema).nullable().describe("Una entrada por cada producto de la lista a dividir, en el mismo orden. null si no se te dio esa lista."),
  anuncios: AdsDiagnosisSchema.nullable().describe("El diagnóstico de los anuncios. null si no se te dieron datos de anuncios."),
});

export type ContentDiagnosis = Omit<z.infer<typeof ContentDiagnosisSchema>, "ideas"> & {
  /** Reports made before the split by product have no `producto` on an idea. */
  ideas: (Omit<z.infer<typeof ContentIdeaSchema>, "producto"> & { producto?: string })[];
  /** Missing in reports made before ads were included. */
  anuncios?: (Omit<z.infer<typeof AdsDiagnosisSchema>, "ideas"> & { ideas: (Omit<z.infer<typeof AdIdeaSchema>, "producto"> & { producto?: string })[] }) | null;
  /** The report split by product. Missing in older reports and when the business has fewer than 2 products. */
  productos?: z.infer<typeof ProductDiagnosisSchema>[] | null;
};
export type AdsDiagnosis = NonNullable<ContentDiagnosis["anuncios"]>;
export type AdIdea = AdsDiagnosis["ideas"][number];
export type ContentIdea = ContentDiagnosis["ideas"][number];
export type ProductDiagnosis = z.infer<typeof ProductDiagnosisSchema>;

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
- Sin datos de anuncios, "anuncios" es null.

Si recibes una lista de PRODUCTOS A DIVIDIR (varios productos o servicios distintos del mismo negocio), el diagnóstico no es uno solo, es por producto:
- Decide a qué producto pertenece cada publicación (y cada campaña) por lo que dice y muestra; si no se nota o es de la marca en general, no se la atribuyas a ninguno.
- Llena "productos" con una entrada por producto, en el mismo orden de la lista: cuántas publicaciones tiene, qué tan trabajado está frente a los demás, cómo le ha ido y cuál es la acción de contenido más importante.
- Cada idea de publicación y cada idea de anuncio lleva en "producto" el nombre EXACTO del producto para el que es. Reparte las ideas entre todos los productos (2 o 3 por producto en publicaciones, al menos 1 en anuncios), dando más a los que tienen menos contenido. Cada idea habla solo de su producto: su público, su promesa y su llamado a escribir; no mezcles los productos en una misma idea.
- Las recomendaciones, lo que funciona y lo que no pueden citar a qué producto se refieren.
- Sin esa lista, "productos" es null y "producto" de cada idea es "General".`;

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
    prisma.product.findMany({ where: { businessId, active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 15, select: { name: true, kind: true, description: true } }),
  ]);
  const industry = INDUSTRY_OPTIONS.find((o) => o.value === business.industry)?.label ?? "otro";
  const catalog = products.length
    ? products.map((p) => `${p.name}${p.kind === "SERVICE" ? " (servicio)" : ""}`).join(", ")
    : "No tiene catálogo cargado; deduce lo que vende de sus publicaciones.";

  // A handful of distinct products: the report is split by them, each with what it is.
  const split = products.length >= 2 && products.length <= MAX_SPLIT_PRODUCTS ? products : null;
  const splitBlock = split
    ? `PRODUCTOS A DIVIDIR (usa estos nombres exactos, en este orden):\n${split
        .map((p, i) => `${i + 1}. ${p.name}${p.kind === "SERVICE" ? " (servicio)" : ""}${p.description.trim() ? `: ${p.description.replace(/\s+/g, " ").trim().slice(0, 240)}` : ""}`)
        .join("\n")}\n`
    : "Sin lista de productos a dividir: \"productos\" es null.\n";

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
${splitBlock}Período analizado: ${data.range.since} a ${data.range.until}.

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
  return { status: "ok", diagnosis: alignProducts(response.parsed_output, split?.map((p) => p.name) ?? []) };
}

/**
 * Makes the product names in a report match the catalog exactly (the model may
 * change a case or an accent), and anything it can't place becomes "General".
 */
export function alignProducts(d: ContentDiagnosis, names: string[]): ContentDiagnosis {
  const plain = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const fix = (name: string | undefined) => names.find((n) => plain(n) === plain(name ?? "")) ?? "General";
  return {
    ...d,
    ideas: d.ideas.map((i) => ({ ...i, producto: fix(i.producto) })),
    anuncios: d.anuncios ? { ...d.anuncios, ideas: d.anuncios.ideas.map((i) => ({ ...i, producto: fix(i.producto) })) } : d.anuncios,
    productos: names.length
      ? names.map((n) => d.productos?.find((p) => plain(p.nombre) === plain(n))).filter((p): p is NonNullable<typeof p> => !!p).map((p, i) => ({ ...p, nombre: names.find((n) => plain(n) === plain(p.nombre)) ?? names[i] }))
      : null,
  };
}
