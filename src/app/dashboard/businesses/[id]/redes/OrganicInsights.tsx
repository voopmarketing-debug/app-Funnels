import type { InstagramAudience, SocialPost } from "@/lib/metaSocial";
import { formatPerformance, organicHighlights, readOrganicVideos } from "@/lib/contentKpis";
import { shortDateTime } from "./format";
import { BarList, Note, ToneList, type BarRow } from "./kpiParts";
import { ChartCard, Section, dec, fmt } from "./ui";

// Métricas, under "Tu contenido": what kind of content works and why (formats,
// how long people watch each video, what gets saved and shared) and who sees
// it. Meta gives the average watch time of an organic video but not the
// 3-second hook or the % watched, so those only appear for ads.

const NETWORK_LABEL = { facebook: "Facebook", instagram: "Instagram" } as const;
const VERSUS = { above: { text: "Retiene más que tus otros videos", tone: "good" }, similar: { text: "Retiene como tus otros videos", tone: "warn" }, below: { text: "Retiene menos que tus otros videos", tone: "bad" } } as const;
const BASIS = { reached: "las personas que ven tu contenido", engaged: "las personas que interactúan con tu contenido", followers: "tus seguidores" } as const;

export function OrganicInsights({ posts }: { posts: SocialPost[] }) {
  if (posts.length === 0) return null;
  const highlights = organicHighlights(posts);
  const formats = formatPerformance(posts).filter((f) => f.rate != null);
  const topRate = Math.max(...formats.map((f) => f.rate ?? 0), 0.0001);
  const { rows: videos, medianWatch } = readOrganicVideos(posts);

  // One post of a kind says nothing: only kinds with two or more compete for "la que mejor funciona".
  const topKind = formats.find((f) => f.count >= 2)?.type;
  const formatRows: BarRow[] = formats.map((f) => ({
    key: f.type,
    label: `${f.type} (${f.count})`,
    pct: ((f.rate ?? 0) / topRate) * 100,
    value: `${dec(f.rate, 1)}%`,
    note: `${fmt(f.avgViews)} vistas en promedio`,
    badge: f.type === topKind && formats.filter((x) => x.count >= 2).length > 1 ? { text: "La que mejor funciona", tone: "good" } : undefined,
  }));

  return (
    <Section title="Qué contenido funciona y por qué" subtitle="Compara tus publicaciones entre sí para saber qué repetir y qué dejar de hacer.">
      {highlights.length > 0 && (
        <div className="fl-card-hero space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Lo primero que haría</p>
          <ToneList items={highlights} />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {formatRows.length > 0 && (
          <ChartCard title="Reacción por tipo de publicación" subtitle="De cada 100 veces que se vio, cuántas veces alguien reaccionó (me gusta, comentarios, guardados, compartidos).">
            <BarList rows={formatRows} color="var(--series-ig)" />
          </ChartCard>
        )}

        {videos.length > 0 && (
          <ChartCard
            title="Cuánto ve la gente tus videos"
            subtitle={medianWatch != null ? `Tiempo promedio que se ve cada video. Tu promedio es ${dec(medianWatch, 1)} segundos.` : "Tiempo promedio que se ve cada video."}
          >
            <ul className="space-y-4">
              {videos.slice(0, 5).map(({ post, watchSeconds, versus, savesPer1000, sharesPer1000, tips }) => (
                <li key={post.id} className="flex gap-3">
                  {post.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnail} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-surface-2 text-[10px] text-ink-faint">{post.type}</span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-ink-muted">
                      {NETWORK_LABEL[post.network]} · {post.type} · {shortDateTime(post.publishedAt)}
                    </p>
                    <p className="line-clamp-1 text-sm text-ink">{post.text || <span className="text-ink-faint">Sin texto</span>}</p>
                    <p className="text-xs text-ink-muted">
                      <span className="font-semibold tabular-nums text-ink">{dec(watchSeconds, 1)} s</span> de promedio · {VERSUS[versus].text.toLowerCase()}
                      {savesPer1000 != null && <> · {dec(savesPer1000, 0)} guardados por mil</>}
                      {sharesPer1000 != null && <> · {dec(sharesPer1000, 0)} compartidos por mil</>}
                    </p>
                    <ToneList items={tips} className="text-sm" />
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                        Ver publicación
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
      </div>

      <Note>
        Para videos publicados sin pagar, Meta solo informa cuánto tiempo se ven en promedio, el alcance, los guardados y los compartidos. No entrega el gancho de 3 segundos ni el porcentaje del video que se vio: eso sí aparece en tus anuncios en video, en la pestaña Anuncios.
      </Note>
    </Section>
  );
}

const PCT = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

function AudienceBars({ title, subtitle, buckets }: { title: string; subtitle: string; buckets: { label: string; value: number }[] }) {
  if (buckets.length === 0) return null;
  const total = buckets.reduce((a, b) => a + b.value, 0);
  const rows: BarRow[] = buckets.map((b) => ({ key: b.label, label: b.label, pct: PCT(b.value, total), value: `${Math.round(PCT(b.value, total))}%`, note: fmt(b.value) }));
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <BarList rows={rows} color="var(--series-ig)" />
    </ChartCard>
  );
}

export function AudienceSection({ audience }: { audience: InstagramAudience | null }) {
  if (!audience) return null;
  return (
    <Section title="¿Quién ve tu Instagram?" subtitle={`Edad, género y ciudades de ${BASIS[audience.basis]}, en los últimos 30 días. Sirve para decidir a quién le hablas y desde dónde publicas.`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <AudienceBars title="Por edad" subtitle="Qué parte de tu audiencia tiene cada edad." buckets={audience.age} />
        <AudienceBars title="Por género" subtitle="Mujeres y hombres que te ven." buckets={audience.gender} />
        <AudienceBars title="Ciudades principales" subtitle="De dónde viene tu audiencia." buckets={audience.cities} />
      </div>
      <Note>Instagram solo comparte estas cifras de cuentas con 100 seguidores o más y las agrupa, así que no muestra personas concretas. Si tu negocio es local, revisa que tus ciudades principales sean las que atiendes.</Note>
    </Section>
  );
}
