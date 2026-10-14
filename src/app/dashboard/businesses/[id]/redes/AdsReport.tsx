import { cpc, cpm, daysIn, frequency, linkCtr, objectiveLabel, roas } from "@/lib/metaSocial";
import { getAdsSection } from "@/lib/socialDashboard";
import type { DayRange } from "@/lib/socialRanges";
import { rangeLabel } from "@/lib/socialRanges";
import { adsHighlights, adviseCampaign, campaignOutcome, VERDICT_LABELS } from "@/lib/adsAdvice";
import { InfoTip } from "../analytics/InfoTip";
import { STATUS_STYLES } from "../analytics/StatTile";
import { AdsTrendChart } from "./AdsTrendChart";
import { CampaignList, type CampaignCard } from "./CampaignList";
import { RefreshButton } from "./controls";
import { moneyFormatter } from "./format";
import { ChartCard, Delta, SectionError, dec, fmt, previousText, type Status } from "./ui";

// The Anuncios tab: every number of the ad account in one block at the top,
// then what to do (in words), when the money went, and each campaign.

type Metric = {
  label: string;
  hint: string;
  value: string;
  description: string;
  status?: Status;
  goal?: string;
  delta?: React.ReactNode;
};

function MetricCell({ m, big }: { m: Metric; big?: boolean }) {
  const s = m.status ? STATUS_STYLES[m.status] : null;
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-ink">{m.label}</p>
        <InfoTip text={m.description} label={m.label} />
      </div>
      <p className="text-xs leading-snug text-ink-muted">{m.hint}</p>
      <p className={`mt-auto pt-2 font-bold tabular-nums tracking-tight text-ink ${big ? (m.value.length > 8 ? "text-xl sm:text-3xl" : "text-2xl sm:text-3xl") : m.value.length > 8 ? "text-xl sm:text-2xl" : "text-2xl"}`}>
        {m.value}
      </p>
      {(s || m.goal) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {s && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold" style={{ background: s.bg, color: s.fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
              {s.label}
            </span>
          )}
          {m.goal && <span className="text-ink-faint">{m.goal}</span>}
        </p>
      )}
      {m.delta}
    </div>
  );
}

function MetricRow({ title, metrics, big }: { title: string; metrics: Metric[]; big?: boolean }) {
  return (
    <div>
      <p className="border-t border-border bg-surface-2/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</p>
      {/* gap-px over the border color draws the grid lines between cells. */}
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCell key={m.label} m={m} big={big} />
        ))}
      </div>
    </div>
  );
}

const updatedLabel = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "Actualizado ahora";
  return `Actualizado hace ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}`;
};

export async function AdsReport({ businessId, range, canManage }: { businessId: string; range: DayRange; canManage: boolean }) {
  const section = await getAdsSection(businessId, range);
  if (section.throttled) {
    return <SectionError error="Consultaste muchas fechas seguidas. Espera unos minutos o vuelve a unas fechas que ya hayas visto." />;
  }
  if (section.needsReconnect) {
    return (
      <div className="fl-card-hero space-y-3 p-5">
        <h2 className="text-base font-semibold">Tu conexión con Facebook venció</h2>
        <p className="text-sm text-ink-muted">Meta pide volver a iniciar sesión cada cierto tiempo. Reconecta y tus anuncios vuelven solos.</p>
        {canManage && (
          <a href={`/api/social/meta/connect?businessId=${businessId}`} className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            Reconectar con Facebook
          </a>
        )}
      </div>
    );
  }
  if (!section.ads) return null;
  if (!section.ads.ok) return <SectionError error={section.ads.error} />;

  const ads = section.ads.data;
  const period = previousText(range);
  const money = moneyFormatter(ads.currency);
  const totalSpend = ads.campaigns.reduce((a, c) => a + c.spend, 0);
  const cards: CampaignCard[] = ads.campaigns.map((c) => {
    const advice = adviseCampaign(c, ads.campaigns, ads.totals);
    return {
      id: c.id,
      name: c.name,
      status: c.status ?? null,
      objective: objectiveLabel(c.objective),
      spend: c.spend,
      share: totalSpend > 0 ? c.spend / totalSpend : 0,
      outcome: campaignOutcome(c),
      verdict: advice.verdict,
      verdictLabel: VERDICT_LABELS[advice.verdict],
      tips: advice.tips,
      linkCtr: linkCtr(c),
      cpc: c.linkClicks ? c.spend / c.linkClicks : null,
      cpm: cpm(c),
      frequency: frequency(c),
      reach: c.reach,
      impressions: c.impressions,
      roas: roas(c),
      updatedAt: c.updatedAt,
    };
  });

  // What the account got, in the words the owner uses: conversations when
  // the ads start chats, otherwise clicks to the link.
  const conversations = ads.totals.conversations ?? 0;
  const main =
    conversations > 0
      ? { count: conversations, prev: ads.previous.conversations ?? 0, label: "Conversaciones", plural: "conversaciones", singular: "conversación", each: "Cada conversación", hint: "Personas que te escribieron por WhatsApp o Messenger gracias al anuncio" }
      : { count: ads.totals.linkClicks ?? 0, prev: ads.previous.linkClicks ?? 0, label: "Clics a tu enlace", plural: "clics a tu enlace", singular: "clic", each: "Cada clic", hint: "Personas que fueron a tu WhatsApp o tu web desde el anuncio" };
  const mainCost = main.count ? ads.totals.spend / main.count : null;
  const prevCost = main.prev ? ads.previous.spend / main.prev : null;
  const roasValue = roas(ads.totals);
  const adsLinkCtr = linkCtr(ads.totals);
  const adsFreq = frequency(ads.totals);
  const highlights = adsHighlights(ads.campaigns, ads.totals, (n) => money(n));

  const keyMetrics: Metric[] = [
    {
      label: "Invertiste",
      hint: "Lo que pagaste a Meta por tus anuncios",
      value: money(ads.totals.spend),
      description: "Lo que Meta te cobró por tus anuncios en estas fechas, en la moneda de tu cuenta publicitaria.",
      delta: <Delta now={ads.totals.spend} before={ads.previous.spend} period={period} invert />,
    },
    {
      label: main.label,
      hint: main.hint,
      value: fmt(main.count),
      description:
        conversations > 0
          ? "Cuántas personas empezaron una conversación por WhatsApp o Messenger después de ver tu anuncio. Son tus posibles clientes."
          : "Clics que llevaron a la persona a donde querías (tu WhatsApp, tu web o tu formulario). No cuenta me gusta ni clics para ver más.",
      delta: <Delta now={main.count} before={main.prev} period={period} />,
    },
    {
      label: main.each,
      hint: "Lo que pagaste en promedio por cada uno",
      value: money(mainCost),
      description:
        "Es el número más importante: compáralo con lo que te deja un cliente. Si un cliente te deja más de lo que pagas por cada conversación, tus anuncios son rentables. Mientras más bajo, mejor.",
      delta: <Delta now={mainCost} before={prevCost} period={period} invert />,
    },
    roasValue != null
      ? {
          label: "Ventas por cada $1",
          hint: "Cuánto vendiste por cada peso invertido",
          value: `${dec(roasValue, 1)}x`,
          status: roasValue >= 3 ? "good" : roasValue >= 1.5 ? "warning" : "critical",
          goal: "Meta: 3x o más",
          description: "Ventas registradas por Meta divididas entre lo que invertiste. 3x significa que por cada 1 que pusiste en anuncios vendiste 3.",
        }
      : {
          label: "Personas que te vieron",
          hint: "Personas distintas que vieron tus anuncios",
          value: fmt(ads.totals.reach),
          description: "Cuántas personas diferentes vieron al menos uno de tus anuncios.",
        },
  ];
  const advancedMetrics: Metric[] = [
    {
      label: "CTR al enlace",
      hint: "De cada 100 que lo ven, cuántos hacen clic",
      value: adsLinkCtr == null ? "—" : `${dec(adsLinkCtr)}%`,
      status: adsLinkCtr == null ? "neutral" : adsLinkCtr >= 1 ? "good" : adsLinkCtr >= 0.6 ? "warning" : "critical",
      goal: "Meta: 1% o más",
      description: "Porcentaje de personas que hicieron clic para ir a tu WhatsApp o web después de ver el anuncio. Si está bajo, el anuncio no llama la atención: cambia la imagen, el video o la primera frase.",
    },
    {
      label: "CPC",
      hint: "Costo por cada clic al enlace",
      value: money(ads.totals.linkClicks ? ads.totals.spend / ads.totals.linkClicks : cpc(ads.totals)),
      description: "Cuánto pagaste, en promedio, por cada persona que hizo clic para ir a tu WhatsApp o web. Mientras más bajo, más visitas consigues con el mismo dinero.",
    },
    {
      label: "CPM",
      hint: "Costo por mil impresiones",
      value: money(cpm(ads.totals)),
      description: "Lo que cuesta mostrar tu anuncio 1.000 veces. Sube cuando el público es muy pequeño o muy disputado (por ejemplo en fechas especiales).",
      delta: <Delta now={cpm(ads.totals)} before={cpm(ads.previous)} period={period} invert />,
    },
    {
      label: "Frecuencia",
      hint: "Veces que cada persona vio tus anuncios",
      value: dec(adsFreq, 1),
      status: adsFreq == null ? "neutral" : adsFreq <= 2.5 ? "good" : adsFreq <= 3.5 ? "warning" : "critical",
      goal: "Ideal: menos de 3",
      description: "Cuántas veces, en promedio, cada persona vio tus anuncios. Arriba de 3 la gente empieza a cansarse y los resultados se encarecen: cambia la imagen o el video, o amplía el público.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="fl-card overflow-hidden p-0" aria-labelledby="ads-metrics-title">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
          <div className="min-w-0">
            <h2 id="ads-metrics-title" className="text-lg font-semibold text-ink">
              Métricas de tus anuncios
            </h2>
            <p className="text-sm text-ink-muted">
              {rangeLabel(range)} · montos en {ads.currency}. Toca ⓘ para ver qué significa cada número.
            </p>
          </div>
          <RefreshButton businessId={businessId} updatedLabel={updatedLabel(section.fetchedAt ?? new Date().toISOString())} />
        </div>
        <MetricRow title="Lo principal" metrics={keyMetrics} big />
        <MetricRow title="Para quien maneja tus anuncios" metrics={advancedMetrics} />
      </section>

      <section className="fl-card-hero space-y-4 p-5 md:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">En resumen</p>
        {ads.totals.spend > 0 ? (
          <p className="max-w-3xl text-lg leading-relaxed text-ink md:text-xl">
            Del {rangeLabel(range).replace(" – ", " al ")} invertiste <strong className="tabular-nums">{money(ads.totals.spend)}</strong> en {cards.length}{" "}
            {cards.length === 1 ? "campaña" : "campañas"}
            {main.count > 0 ? (
              <>
                {" "}
                y conseguiste <strong className="tabular-nums">{fmt(main.count)}</strong> {main.count === 1 ? main.singular : main.plural}: {main.each.toLowerCase()} te costó{" "}
                <strong className="tabular-nums">{money(mainCost)}</strong>.
              </>
            ) : (
              <> pero no conseguiste {main.plural}.</>
            )}{" "}
            Tus anuncios los vieron <strong className="tabular-nums">{fmt(ads.totals.reach)}</strong> personas.
          </p>
        ) : (
          <p className="text-lg text-ink">No invertiste en anuncios en estas fechas. Elige otras fechas arriba para ver campañas anteriores (por ejemplo, Últimos 12 meses).</p>
        )}
        {highlights.length > 0 && (
          <ul className="space-y-2 border-t border-border pt-4">
            {highlights.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                <span className="mt-2 h-2 w-2 flex-none rounded-full" style={{ background: h.tone === "good" ? "#0ca30c" : h.tone === "bad" ? "#d03b3b" : "#fab219" }} />
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChartCard title="¿Cuándo invertiste y qué te trajo?" subtitle="Toca una barra para ver el detalle.">
        <AdsTrendChart days={daysIn(range)} daily={ads.daily} currency={ads.currency} hasConversations={conversations > 0} />
      </ChartCard>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Tus campañas</h2>
          <p className="text-sm text-ink-muted">Cada campaña con lo que invertiste, lo que te trajo y qué hacer con ella. Primero las que necesitan atención.</p>
        </div>
        <CampaignList campaigns={cards} currency={ads.currency} />
      </section>
    </div>
  );
}
