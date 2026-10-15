import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { PageSkeleton } from "@/components/PageSkeleton";
import { daysIn, listAdAccounts, listPages, type SocialPost } from "@/lib/metaSocial";
import { getSocialDashboard, type NetworkSummary, type SectionResult } from "@/lib/socialDashboard";
import { parseRange, todayInColombia, type DayRange } from "@/lib/socialRanges";
import type { ContentDiagnosis } from "@/lib/contentDiagnosis";
import { StatTile } from "../analytics/StatTile";
import { AccountPicker, DisconnectButton, NetworkChart, RefreshButton } from "./controls";
import { DateRangePicker } from "./DateRangePicker";
import { RedesTabs } from "./RedesTabs";
import { PostsTable } from "./tables";
import { ContentDiagnosisPanel } from "./ContentDiagnosisPanel";
import { shortDateTime } from "./format";
import { EyeIcon, FacebookGlyph, GridIcon, HeartIcon, InstagramGlyph, PercentIcon } from "./icons";
import { ChartCard, Delta, Section, SectionError, dec, fmt, previousText, type Status } from "./ui";

const NETWORK = {
  facebook: { label: "Facebook", tone: "facebook" as const, glyph: <FacebookGlyph /> },
  instagram: { label: "Instagram", tone: "instagram" as const, glyph: <InstagramGlyph /> },
};

function NetworkTiles({ network, result, period }: { network: "facebook" | "instagram"; result: SectionResult<NetworkSummary>; period: string }) {
  const meta = NETWORK[network];
  if (!result.ok) {
    return (
      <div className="col-span-2 lg:col-span-3">
        <SectionError error={`${meta.label}: ${result.error}`} />
      </div>
    );
  }
  const n = result.data;
  const isIg = network === "instagram";
  return (
    <>
      <StatTile
        label={`Seguidores en ${meta.label}`}
        hint="Personas que siguen tu cuenta hoy"
        value={fmt(n.followers)}
        sublabel={n.followersDelta != null ? `${n.followersDelta >= 0 ? "+" : ""}${fmt(n.followersDelta)} en el período` : undefined}
        description={`Cuántas personas siguen tu ${isIg ? "cuenta de Instagram" : "página de Facebook"} hoy. El número pequeño es cuántos ganaste (o perdiste) en el período: seguidores nuevos menos los que dejaron de seguirte.`}
        tone={meta.tone}
        icon={meta.glyph}
      />
      <StatTile
        label={isIg ? "Visualizaciones" : "Visualizaciones"}
        hint="Veces que se vio tu contenido"
        value={fmt(n.views)}
        description={
          isIg
            ? "Cuántas veces se vieron tus publicaciones, reels e historias de Instagram, contando cada vez que alguien las vio (una persona puede sumar varias). Sirve para saber cuánto se está moviendo tu contenido."
            : "Cuántas veces se vio el contenido de tu página de Facebook (publicaciones, fotos, videos), contando cada vez que apareció en pantalla."
        }
        tone={meta.tone}
        icon={<EyeIcon />}
      >
        <Delta now={n.views} before={n.viewsPrev} period={period} />
      </StatTile>
      <StatTile
        label="Interacciones"
        hint="Reacciones, comentarios y compartidos"
        value={fmt(n.engagement)}
        description={`Todas las veces que alguien hizo algo con tu contenido: ${isIg ? "me gusta, comentarios, guardados y compartidos" : "reacciones, comentarios, compartidos y clics"}. Es la mejor señal de que tu contenido le interesa a tu audiencia, más que las visualizaciones.`}
        tone={meta.tone}
        icon={<HeartIcon />}
      >
        <Delta now={n.engagement} before={n.engagementPrev} period={period} />
      </StatTile>
    </>
  );
}

/** Day-over-day change of a running total: "new followers per day". */
function dailyChange(series: Record<string, number>, days: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  days.forEach((day, i) => {
    const prevDay = i > 0 ? days[i - 1] : null;
    out[day] = prevDay && series[day] != null && series[prevDay] != null ? series[day] - series[prevDay] : null;
  });
  return out;
}

function engagementRate(posts: SocialPost[]): number | null {
  const withViews = posts.filter((p) => p.views);
  const views = withViews.reduce((a, p) => a + (p.views ?? 0), 0);
  return views > 0 ? (withViews.reduce((a, p) => a + p.interactions, 0) / views) * 100 : null;
}

const rateStatus = (r: number | null): Status => (r == null ? "neutral" : r >= 3 ? "good" : r >= 1 ? "warning" : "critical");

function TopPosts({ posts }: { posts: SocialPost[] }) {
  const top = [...posts].sort((a, b) => b.interactions - a.interactions).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">Tus publicaciones que mejor funcionaron</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((p, i) => (
          <article key={p.id} className="fl-card flex min-w-0 gap-3 p-3">
            <div className="relative flex-none">
              {p.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail} alt="" className="h-20 w-20 rounded-xl object-cover" loading="lazy" />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-2 text-xs text-ink-faint">{p.type}</span>
              )}
              <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: p.network === "facebook" ? "var(--series-fb)" : "var(--series-ig)" }} />
                {p.network === "facebook" ? "Facebook" : "Instagram"} · {p.type} · {shortDateTime(p.publishedAt)}
              </p>
              <p className="line-clamp-2 text-sm text-ink">{p.text || <span className="text-ink-faint">Sin texto</span>}</p>
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-ink">{fmt(p.interactions)}</span> interacciones
                {p.views != null && (
                  <>
                    {" "}
                    · <span className="font-semibold text-ink">{fmt(p.views)}</span> visualizaciones
                  </>
                )}
              </p>
              {p.permalink && (
                <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                  Ver publicación
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function updatedLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "Actualizado ahora";
  return `Actualizado hace ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}`;
}

type InitialDiagnosis = { diagnosis: ContentDiagnosis; generatedAt: string } | null;

async function Dashboard({
  businessId,
  range,
  canManage,
  initialDiagnosis,
}: {
  businessId: string;
  range: DayRange;
  canManage: boolean;
  initialDiagnosis: InitialDiagnosis;
}) {
  const data = await getSocialDashboard(businessId, range);
  if (data.throttled) {
    return (
      <div className="fl-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Consultaste muchos periodos seguidos</h2>
        <p className="text-sm text-ink-muted">
          Para no agotar el límite de consultas que Meta da a tu página, espera unos minutos o vuelve a un periodo que ya hayas visto (esos abren al instante).
        </p>
      </div>
    );
  }
  if (data.needsReconnect) {
    return (
      <div className="fl-card-hero space-y-3 p-5">
        <h2 className="text-base font-semibold">Tu conexión con Facebook venció</h2>
        <p className="text-sm text-ink-muted">Meta pide volver a iniciar sesión cada cierto tiempo o cuando cambias la contraseña. Reconecta y las métricas vuelven solas.</p>
        {canManage && (
          <a href={`/api/social/meta/connect?businessId=${businessId}`} className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            Reconectar con Facebook
          </a>
        )}
      </div>
    );
  }

  const period = previousText(range);
  const days = daysIn(data.range);
  const networks = (["facebook", "instagram"] as const).filter((n) => data[n]);
  const posts = data.posts?.ok ? data.posts.data : [];
  const postInteractions = posts.reduce((a, p) => a + p.interactions, 0);
  const postViews = posts.some((p) => p.views != null) ? posts.reduce((a, p) => a + (p.views ?? 0), 0) : null;
  const rate = engagementRate(posts);

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <RefreshButton businessId={businessId} updatedLabel={updatedLabel(data.fetchedAt)} />
      </div>

      {networks.length > 0 && (
        <Section title="Tu comunidad" subtitle="Cuánta gente te sigue, ve tu contenido e interactúa contigo. Toca ⓘ en cualquier tarjeta para ver qué significa.">
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
            {networks.map((n) => (
              <NetworkTiles key={n} network={n} result={data[n]!} period={period} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Seguidores nuevos por día" subtitle="Seguidores ganados menos los que dejaron de seguirte. Si sube, tu contenido está atrayendo gente nueva.">
              <NetworkChart
                days={days}
                label="Seguidores nuevos por día"
                emptyText="Meta todavía no tiene el historial de seguidores"
                series={networks.flatMap((n) => {
                  const r = data[n]!;
                  return r.ok ? [{ key: n, values: dailyChange(r.data.followersSeries, days) }] : [];
                })}
              />
            </ChartCard>
            <ChartCard title="Alcance por día" subtitle="Facebook: veces que se vio tu contenido. Instagram: personas distintas que lo vieron. Los picos coinciden con lo que más gustó.">
              <NetworkChart
                days={days}
                label="Alcance por día"
                series={networks.flatMap((n) => {
                  const r = data[n]!;
                  return r.ok && r.data.viewsSeries ? [{ key: n, values: r.data.viewsSeries }] : [];
                })}
              />
            </ChartCard>
          </div>
        </Section>
      )}

      {data.posts && (
        <Section title="Tu contenido" subtitle="Lo que publicaste en el período, qué tanto gustó y qué hacer después.">
          {data.posts.ok ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                <StatTile
                  label="Publicaciones"
                  hint="Lo que publicaste en el período"
                  value={fmt(posts.length)}
                  description="Cuántas publicaciones, reels y videos subiste a tu feed en el período (las historias no cuentan). Publicar seguido, 3 a 5 veces por semana, ayuda a que Meta muestre más tu contenido."
                  tone="blue"
                  icon={<GridIcon />}
                />
                <StatTile
                  label="Visualizaciones"
                  hint="Veces que se vieron tus publicaciones"
                  value={fmt(postViews)}
                  description="La suma de las veces que se vio cada una de tus publicaciones del período."
                  tone="secondary"
                  icon={<EyeIcon />}
                />
                <StatTile
                  label="Interacciones"
                  hint="Reacciones, comentarios, compartidos y guardados"
                  value={fmt(postInteractions)}
                  sublabel={posts.length ? `${fmt(postInteractions / posts.length)} por publicación` : undefined}
                  description="Todo lo que la gente hizo con tus publicaciones: me gusta, reacciones, comentarios, compartidos y guardados. El número pequeño es el promedio por publicación."
                  tone="amber"
                  icon={<HeartIcon />}
                />
                <StatTile
                  label="Tasa de interacción"
                  hint="De cada 100 que lo vieron, cuántos interactuaron"
                  value={rate == null ? "—" : `${dec(rate, 1)}%`}
                  status={rateStatus(rate)}
                  goal="Meta: 3% o más"
                  description="Interacciones divididas entre visualizaciones. Mide qué tan interesante es tu contenido sin importar cuánta gente lo vio: es la métrica que más dice si vas por buen camino."
                  tone="accent"
                  icon={<PercentIcon />}
                />
              </div>
              <TopPosts posts={posts} />
            </>
          ) : (
            <SectionError error={data.posts.error} />
          )}
        </Section>
      )}

      {data.posts && <ContentDiagnosisPanel businessId={businessId} initial={initialDiagnosis} />}

      {data.posts?.ok && posts.length > 0 && (
        <details className="group space-y-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-accent">
            Ver todas las publicaciones ({posts.length})
            <span className="text-ink-muted transition group-open:rotate-180" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="pt-3">
            <PostsTable posts={posts} />
          </div>
        </details>
      )}

      {data.ads && (
        <Link
          href={`/dashboard/businesses/${businessId}/redes/anuncios`}
          className="fl-card flex items-center justify-between gap-4 p-4 transition hover:border-accent md:p-5"
        >
          <span className="min-w-0">
            <span className="block text-base font-semibold text-ink">📣 Tus anuncios y campañas</span>
            <span className="block text-sm text-ink-muted">Cuánto invertiste, qué te trajo cada campaña y qué hacer, con sus propias fechas.</span>
          </span>
          <span className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Ver anuncios →</span>
        </Link>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  cancelled: "Cancelaste el inicio de sesión con Facebook. Cuando quieras, vuelve a intentarlo.",
  meta: "Meta no completó la conexión. Intenta de nuevo; si sigue fallando, escríbenos a soporte.",
  config: "La conexión con Facebook aún no está activada en la plataforma. Escríbenos a soporte.",
};

export default async function RedesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; choose?: string; error?: string }>;
}) {
  const { id } = await params;
  const { desde, hasta, choose, error } = await searchParams;
  const today = todayInColombia();
  const range = parseRange({ desde, hasta }, today);

  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, socialConnection: true } } },
  });
  if (!membership) notFound();
  const { business } = membership;
  const connection = business.socialConnection;
  const canManage = membership.role !== "MEMBER";
  const hasSelection = Boolean(connection && (connection.fbPageId || connection.adAccountId));
  const initialDiagnosis: InitialDiagnosis =
    connection?.contentDiagnosis && connection.contentDiagnosisAt
      ? { diagnosis: connection.contentDiagnosis as unknown as ContentDiagnosis, generatedAt: connection.contentDiagnosisAt.toISOString() }
      : null;

  let picker: React.ReactNode = null;
  if (connection?.userAccessToken && canManage && (choose === "1" || !hasSelection)) {
    const token = decryptSecret(connection.userAccessToken);
    const [pages, adAccounts] = await Promise.all([listPages(token).catch(() => []), listAdAccounts(token).catch(() => [])]);
    picker = (
      <AccountPicker
        businessId={id}
        pages={pages.map((p) => ({ id: p.id, name: p.name, igUsername: p.igUsername }))}
        adAccounts={adAccounts}
        currentPageId={connection.fbPageId}
        currentAdAccountId={connection.adAccountId}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-4">
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Redes sociales</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              Cómo le va a tu Facebook, tu Instagram y tus anuncios: qué funciona, qué no y qué hacer ahora.
            </p>
          </div>
          <RedesTabs businessId={id} active="metricas" />
        </div>
        {hasSelection && <DateRangePicker value={range} today={today} />}
        {connection && hasSelection && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {connection.fbPageName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-fb)" }} />
                {connection.fbPageName}
              </span>
            )}
            {connection.igUsername && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-ig)" }} />@{connection.igUsername}
              </span>
            )}
            {connection.adAccountName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-ink">📣 {connection.adAccountName}</span>
            )}
            {canManage && (
              <span className="flex items-center gap-3 pl-1 text-ink-muted">
                <Link href={`?choose=1`} className="font-semibold underline hover:text-ink">
                  Cambiar cuentas
                </Link>
                {/* Logs in with Meta again (e.g. to accept new permissions) keeping everything saved here. */}
                <a
                  href={`/api/social/meta/connect?businessId=${id}`}
                  title="Vuelve a iniciar sesión con Facebook para aceptar permisos nuevos, sin perder nada"
                  className="font-semibold underline hover:text-ink"
                >
                  Reconectar
                </a>
                <DisconnectButton businessId={id} />
              </span>
            )}
          </div>
        )}
      </header>

      {error && ERRORS[error] && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-ink">{ERRORS[error]}</div>}

      {!connection ? (
        <section className="fl-card-hero space-y-4 p-6">
          <h2 className="text-lg font-semibold">Conecta tus redes de Meta</h2>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>• Seguidores, alcance e interacciones de tu página de Facebook y tu Instagram.</li>
            <li>• Tus mejores publicaciones y un diagnóstico con IA con ideas de contenido listas para publicar.</li>
            <li>• Tus anuncios: inversión, costo por resultado, conversaciones, CTR, CPC, CPM y qué hacer con cada campaña.</li>
          </ul>
          <p className="text-xs text-ink-faint">Solo pedimos permisos de lectura: no publicamos nada ni tocamos tus anuncios.</p>
          {canManage ? (
            <a href={`/api/social/meta/connect?businessId=${id}`} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#1877f2" }}>
              Conectar con Facebook
            </a>
          ) : (
            <p className="text-sm text-ink-muted">Pídele al dueño del negocio que conecte su cuenta de Facebook.</p>
          )}
        </section>
      ) : !hasSelection ? (
        (picker ?? <p className="text-sm text-ink-muted">El dueño del negocio todavía no eligió qué página y cuenta publicitaria medir.</p>)
      ) : (
        <>
          {picker}
          <Suspense key={`${range.since}:${range.until}`} fallback={<PageSkeleton />}>
            <Dashboard businessId={id} range={range} canManage={canManage} initialDiagnosis={initialDiagnosis} />
          </Suspense>
        </>
      )}
    </div>
  );
}
