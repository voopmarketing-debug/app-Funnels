import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cpc, cpm, ctr, daysIn, listAdAccounts, listPages, objectiveLabel, type AdCampaign } from "@/lib/metaSocial";
import { getSocialDashboard, isSocialRangeKey, type NetworkSummary, type SectionResult, type SocialRangeKey } from "@/lib/socialDashboard";
import { AccountPicker, AdsDailyChart, DisconnectButton, NetworkChart, RefreshButton, SocialRangePills } from "./controls";
import { CampaignsTable, PostsTable } from "./tables";
import { moneyFormatter } from "./format";

const NETWORK = {
  facebook: { label: "Facebook", color: "var(--series-fb)" },
  instagram: { label: "Instagram", color: "var(--series-ig)" },
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-CO"));

function Delta({ now, before, invert = false }: { now: number | null | undefined; before: number | null | undefined; invert?: boolean }) {
  if (now == null || before == null || before === 0) return null;
  const pct = ((now - before) / before) * 100;
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className="text-xs font-semibold tabular-nums" style={{ color: Math.abs(pct) < 0.5 ? "var(--ink-muted)" : good ? "var(--status-good)" : "var(--status-bad)" }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0).replace(".", ",")}%
    </span>
  );
}

function Metric({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tabular-nums tracking-tight text-ink">
        {value}
        {delta}
      </p>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, children, aside }: { title: string; subtitle: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SectionError({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
      Meta no nos dio estos datos ahora: <span className="text-ink">{error}</span>. Prueba con «Actualizar» en unos minutos.
    </div>
  );
}

function NetworkCard({ network, result, handle }: { network: "facebook" | "instagram"; result: SectionResult<NetworkSummary>; handle: string | null }) {
  const meta = NETWORK[network];
  return (
    <div className="fl-card min-w-0 space-y-4 p-4 md:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
        {meta.label}
        {handle && <span className="truncate font-normal text-ink-muted">{handle}</span>}
      </p>
      {result.ok ? (
        <div className="grid grid-cols-3 gap-3">
          <Metric
            label="Seguidores"
            value={fmt(result.data.followers)}
            hint={result.data.followersDelta != null ? `${result.data.followersDelta >= 0 ? "+" : ""}${fmt(result.data.followersDelta)} en el período` : undefined}
          />
          <Metric
            label="Visualizaciones"
            value={fmt(result.data.views)}
            delta={<Delta now={result.data.views} before={result.data.viewsPrev} />}
          />
          <Metric
            label="Interacciones"
            value={fmt(result.data.engagement)}
            delta={<Delta now={result.data.engagement} before={result.data.engagementPrev} />}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Meta no nos dio estos datos: {result.error}</p>
      )}
    </div>
  );
}

function updatedLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "Actualizado ahora";
  return `Actualizado hace ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}`;
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

async function Dashboard({ businessId, rangeKey, igHandle, fbName, canManage }: { businessId: string; rangeKey: SocialRangeKey; igHandle: string | null; fbName: string | null; canManage: boolean }) {
  const data = await getSocialDashboard(businessId, rangeKey);
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

  const days = daysIn(data.range);
  const networks = (["facebook", "instagram"] as const).filter((n) => data[n]);
  const posts = data.posts?.ok ? data.posts.data : [];
  const postInteractions = posts.reduce((a, p) => a + p.interactions, 0);
  const postViews = posts.some((p) => p.views != null) ? posts.reduce((a, p) => a + (p.views ?? 0), 0) : null;
  const ads = data.ads?.ok ? data.ads.data : null;
  const money = moneyFormatter(ads?.currency ?? "USD");
  const results = ads ? ads.campaigns.reduce<number | null>((acc, c: AdCampaign) => (c.results == null ? acc : (acc ?? 0) + c.results), null) : null;
  const objectiveLabels = ads ? Object.fromEntries(ads.campaigns.map((c) => [c.objective, objectiveLabel(c.objective)])) : {};
  const handles = { facebook: fbName, instagram: igHandle ? `@${igHandle}` : null };

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <RefreshButton businessId={businessId} updatedLabel={updatedLabel(data.fetchedAt)} />
      </div>

      {networks.length > 0 && (
        <Section title="Comunidad" subtitle="Cuánta gente te sigue, te ve e interactúa contigo. Las flechas comparan con el período anterior.">
          <div className="grid gap-4 lg:grid-cols-2">
            {networks.map((n) => (
              <NetworkCard key={n} network={n} result={data[n]!} handle={handles[n]} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="fl-card min-w-0 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-ink">Seguidores nuevos por día</h3>
              <p className="mb-4 mt-0.5 text-xs text-ink-muted">Seguidores ganados menos los que dejaron de seguirte.</p>
              <NetworkChart
                days={days}
                label="Seguidores nuevos por día"
                emptyText="Meta todavía no tiene el historial de seguidores"
                series={networks.flatMap((n) => {
                  const r = data[n]!;
                  return r.ok ? [{ key: n, values: dailyChange(r.data.followersSeries, days) }] : [];
                })}
              />
            </div>
            <div className="fl-card min-w-0 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-ink">Alcance por día</h3>
              <p className="mb-4 mt-0.5 text-xs text-ink-muted">Facebook: veces que se vio tu contenido. Instagram: cuentas que lo vieron.</p>
              <NetworkChart
                days={days}
                label="Alcance por día"
                series={networks.flatMap((n) => {
                  const r = data[n]!;
                  return r.ok && r.data.viewsSeries ? [{ key: n, values: r.data.viewsSeries }] : [];
                })}
              />
            </div>
          </div>
        </Section>
      )}

      {data.posts && (
        <Section title="Publicaciones" subtitle="Lo que publicaste en el período y cómo le fue a cada una.">
          {data.posts.ok ? (
            <>
              <div className="fl-card grid grid-cols-2 gap-4 p-4 md:grid-cols-4 md:p-5">
                <Metric label="Publicaciones" value={fmt(posts.length)} />
                <Metric label="Interacciones" value={fmt(postInteractions)} hint="Reacciones, comentarios, compartidos y guardados" />
                <Metric label="Visualizaciones" value={fmt(postViews)} />
                <Metric label="Interacciones por publicación" value={posts.length ? fmt(postInteractions / posts.length) : "—"} />
              </div>
              <PostsTable posts={posts} />
            </>
          ) : (
            <SectionError error={data.posts.error} />
          )}
        </Section>
      )}

      {data.ads && (
        <Section title="Anuncios" subtitle={`Tus campañas de Meta Ads · montos en ${ads?.currency ?? "la moneda de tu cuenta"}. Las flechas comparan con el período anterior.`}>
          {ads ? (
            <>
              <div className="fl-card grid grid-cols-2 gap-x-4 gap-y-5 p-4 md:grid-cols-4 md:p-5">
                <Metric label="Gasto" value={money(ads.totals.spend)} delta={<Delta now={ads.totals.spend} before={ads.previous.spend} invert />} />
                <Metric label="Impresiones" value={fmt(ads.totals.impressions)} delta={<Delta now={ads.totals.impressions} before={ads.previous.impressions} />} />
                <Metric label="Clics" value={fmt(ads.totals.clicks)} delta={<Delta now={ads.totals.clicks} before={ads.previous.clicks} />} />
                <Metric label="CTR" value={ctr(ads.totals) == null ? "—" : `${ctr(ads.totals)!.toFixed(2).replace(".", ",")}%`} delta={<Delta now={ctr(ads.totals)} before={ctr(ads.previous)} />} hint="Clics por cada 100 impresiones" />
                <Metric label="CPM" value={money(cpm(ads.totals))} delta={<Delta now={cpm(ads.totals)} before={cpm(ads.previous)} invert />} hint="Costo por mil impresiones" />
                <Metric label="CPC" value={money(cpc(ads.totals))} delta={<Delta now={cpc(ads.totals)} before={cpc(ads.previous)} invert />} hint="Costo por clic" />
                <Metric label="Resultados" value={fmt(results)} hint="Según el objetivo de cada campaña" />
                <Metric label="Costo por resultado" value={results ? money(ads.totals.spend / results) : "—"} />
              </div>
              <div className="fl-card min-w-0 p-4 md:p-5">
                <h3 className="mb-3 text-sm font-semibold text-ink">Evolución diaria</h3>
                <AdsDailyChart days={days} daily={ads.daily} currency={ads.currency} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">Campañas</h3>
                <CampaignsTable campaigns={ads.campaigns} currency={ads.currency} objectiveLabels={objectiveLabels} />
              </div>
            </>
          ) : (
            data.ads && !data.ads.ok && <SectionError error={data.ads.error} />
          )}
        </Section>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  cancelled: "Cancelaste el inicio de sesión con Facebook. Cuando quieras, vuelve a intentarlo.",
  meta: "Meta no completó la conexión. Intenta de nuevo; si sigue fallando, escríbenos a soporte.",
  config: "La conexión con Facebook aún no está activada en la plataforma. Escríbenos a soporte.",
};

export default async function RedesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string; choose?: string; error?: string }> }) {
  const { id } = await params;
  const { range, choose, error } = await searchParams;
  const rangeKey: SocialRangeKey = range && isSocialRangeKey(range) ? range : "30d";

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
            <p className="mt-1 max-w-xl text-sm text-ink-muted">Facebook, Instagram y tus anuncios de Meta en un solo lugar.</p>
          </div>
          {hasSelection && !picker && <SocialRangePills value={rangeKey} />}
        </div>
        {connection && hasSelection && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            {connection.fbPageName && <span>Página: <span className="text-ink">{connection.fbPageName}</span></span>}
            {connection.igUsername && <span>Instagram: <span className="text-ink">@{connection.igUsername}</span></span>}
            {connection.adAccountName && <span>Anuncios: <span className="text-ink">{connection.adAccountName}</span></span>}
            {canManage && (
              <>
                <Link href={`?choose=1`} className="font-semibold underline hover:text-ink">
                  Cambiar cuentas
                </Link>
                <DisconnectButton businessId={id} />
              </>
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
            <li>• Cómo le fue a cada publicación, con búsqueda y descarga en CSV.</li>
            <li>• Tus anuncios: gasto, impresiones, clics, CPM, CPC, CTR y resultados por campaña.</li>
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
      ) : picker ? (
        picker
      ) : !hasSelection ? (
        <p className="text-sm text-ink-muted">El dueño del negocio todavía no eligió qué página y cuenta publicitaria medir.</p>
      ) : (
        <Suspense key={rangeKey} fallback={<PageSkeleton />}>
          <Dashboard businessId={id} rangeKey={rangeKey} igHandle={connection.igUsername} fbName={connection.fbPageName} canManage={canManage} />
        </Suspense>
      )}
    </div>
  );
}
