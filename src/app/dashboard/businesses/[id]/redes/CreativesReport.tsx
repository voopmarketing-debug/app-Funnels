import { getCreativesSection } from "@/lib/socialDashboard";
import { rangeLabel, type DayRange } from "@/lib/socialRanges";
import {
  THRESHOLDS,
  accountCreativeKpis,
  adviseCreative,
  costPerConversation,
  creativeHighlights,
  holdRate,
  hookRate,
  levelOf,
  linkClickRate,
  readSegments,
  retentionSteps,
  scoreContext,
  scoreLabel,
  segmentTips,
  type Level,
  type Segment,
} from "@/lib/contentKpis";
import { StatTile } from "../analytics/StatTile";
import { CursorClickIcon } from "../analytics/StatIcons";
import { EyeIcon, PercentIcon, TargetIcon } from "./icons";
import { CreativeList, type CreativeCard } from "./CreativeList";
import { BarList, Note, ToneList, type BarRow } from "./kpiParts";
import { moneyFormatter } from "./format";
import { ChartCard, Section, SectionError, dec } from "./ui";

// Anuncios, below the account totals: each ad with its video funnel and what
// to do about it, then who the ads reach and where they work best.

const levelStatus = (l: Level | null) => (l === "good" ? "good" : l === "ok" ? "warning" : l === "weak" ? "critical" : "neutral");
const pctText = (n: number | null) => (n == null ? "—" : `${n < 10 ? dec(n, 1) : Math.round(n)}%`);

function SegmentCard({ title, subtitle, segments, money, what }: { title: string; subtitle: string; segments: Segment[]; money: (n: number) => string; what: string }) {
  const reading = readSegments(segments);
  if (reading.rows.length === 0) return null;
  const rows: BarRow[] = reading.rows.slice(0, 8).map((r) => ({
    key: r.key,
    label: r.label,
    pct: r.spendShare * 100,
    value: money(r.spend),
    note: reading.unit && r.cost != null ? `${money(r.cost)} por ${reading.unit}` : reading.unit ? `ninguna ${reading.unit}` : undefined,
    badge: reading.best?.key === r.key ? { text: "La más barata", tone: "good" } : reading.worst?.key === r.key ? { text: "Revisar", tone: "bad" } : undefined,
  }));
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <BarList rows={rows} />
        <ToneList items={segmentTips(reading, money, what)} className="border-t border-border pt-3" />
      </div>
    </ChartCard>
  );
}

export async function CreativesReport({ businessId, range, currency }: { businessId: string; range: DayRange; currency: string }) {
  const section = await getCreativesSection(businessId, range);
  if (section.throttled || section.needsReconnect || (!section.creatives && !section.audience && !section.placements)) return null;

  const money = moneyFormatter(currency);
  const m = (n: number) => money(n);

  let creativesBlock: React.ReactNode = null;
  if (section.creatives) {
    if (!section.creatives.ok) {
      creativesBlock = <SectionError error={section.creatives.error} />;
    } else if (section.creatives.data.length === 0) {
      creativesBlock = <p className="fl-card p-6 text-center text-sm text-ink-muted">Ningún anuncio tuvo inversión en estas fechas.</p>;
    } else {
      const list = section.creatives.data;
      const ctx = scoreContext(list.map((c) => c.numbers));
      const totalSpend = list.reduce((a, c) => a + c.numbers.spend, 0);
      const entries = list.map((c) => ({ name: c.name, numbers: c.numbers, advice: adviseCreative(c.numbers, ctx) }));
      const cards: CreativeCard[] = list.map((c, i) => {
        const advice = entries[i].advice;
        const hook = hookRate(c.numbers);
        const hold = holdRate(c.numbers);
        const ctr = linkClickRate(c.numbers);
        const factor = (key: string) => advice.factors.find((f) => f.key === key)?.level ?? null;
        return {
          id: c.id,
          name: c.name,
          campaignName: c.campaignName,
          status: c.status,
          thumbnail: c.thumbnail,
          isVideo: c.isVideo,
          spend: c.numbers.spend,
          share: totalSpend > 0 ? c.numbers.spend / totalSpend : 0,
          verdict: advice.verdict,
          verdictLabel: advice.verdictLabel,
          score: advice.score,
          scoreLabel: advice.score == null ? null : scoreLabel(advice.score),
          hook,
          hookLevel: hook == null ? null : levelOf(hook, THRESHOLDS.hook),
          hold,
          holdLevel: hold == null ? null : levelOf(hold, THRESHOLDS.hold),
          ctr,
          ctrLevel: factor("ctr"),
          cost: costPerConversation(c.numbers),
          costLevel: factor("cost"),
          conversations: c.numbers.conversations,
          frequency: c.numbers.frequency,
          frequencyLevel: factor("frequency"),
          avgWatchSeconds: c.numbers.video?.avgWatchSeconds ?? null,
          retention: retentionSteps(c.numbers.video),
          rankings: c.rankings,
          actions: advice.actions,
        };
      });
      const kpis = accountCreativeKpis(list.map((c) => c.numbers));
      const scored = entries.filter((e) => e.advice.score != null);
      const avgScore = scored.length ? Math.round(scored.reduce((a, e) => a + (e.advice.score ?? 0) * e.numbers.spend, 0) / scored.reduce((a, e) => a + e.numbers.spend, 0)) : null;
      const highlights = creativeHighlights(entries, m);

      creativesBlock = (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile
              label="Gancho de tus videos"
              hint="De cada 100 que lo ven, cuántos se detienen 3 segundos"
              value={pctText(kpis.hook)}
              status={levelStatus(kpis.hook == null ? null : levelOf(kpis.hook, THRESHOLDS.hook))}
              goal={`Referencia: ${THRESHOLDS.hook.good}% o más`}
              description="Mide si los primeros 3 segundos de tu video hacen que la gente se detenga en vez de seguir de largo. Es el primer filtro: si el gancho falla, nada de lo demás importa. Se calcula como reproducciones de 3 segundos entre veces que se mostró el anuncio."
              tone="blue"
              icon={<EyeIcon />}
            />
            <StatTile
              label="Retención de tus videos"
              hint="De los que se detienen, cuántos lo ven casi completo"
              value={pctText(kpis.hold)}
              status={levelStatus(kpis.hold == null ? null : levelOf(kpis.hold, THRESHOLDS.hold))}
              goal={`Referencia: ${THRESHOLDS.hold.good}% o más`}
              description="De las personas que se detuvieron 3 segundos, cuántas siguieron hasta 15 segundos o hasta el final (lo que Meta llama ThruPlay). Si es baja, el video es lento o el mensaje llega tarde."
              tone="secondary"
              icon={<PercentIcon />}
            />
            <StatTile
              label="Clics al enlace"
              hint="De cada 100 que lo ven, cuántos hacen clic"
              value={kpis.ctr == null ? "—" : `${dec(kpis.ctr, 2)}%`}
              status={levelStatus(kpis.ctr == null ? null : levelOf(kpis.ctr, THRESHOLDS.ctr))}
              goal={`Referencia: ${THRESHOLDS.ctr.good}% o más`}
              description="De cada 100 veces que se mostró un anuncio, cuántas personas hicieron clic para ir a tu WhatsApp o tu web. Si el gancho y la retención están bien pero esto es bajo, falta un llamado a la acción claro."
              tone="accent"
              icon={<CursorClickIcon />}
            />
            <StatTile
              label="Nota de tus anuncios"
              hint="Promedio de 0 a 100, ponderado por inversión"
              value={avgScore == null ? "—" : String(avgScore)}
              sublabel={avgScore == null ? undefined : scoreLabel(avgScore)}
              description="Una nota nuestra, de 0 a 100, que junta gancho, retención, clics, costo por conversación y frecuencia de cada anuncio. Los anuncios que más invierten pesan más. Sirve para saber rápido cuáles escalar y cuáles reemplazar."
              tone="amber"
              icon={<TargetIcon />}
            />
          </div>

          {highlights.length > 0 && (
            <div className="fl-card-hero space-y-3 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Lo primero que haría</p>
              <ToneList items={highlights} />
            </div>
          )}

          <CreativeList creatives={cards} currency={currency} />

          <details className="group rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
            <summary className="cursor-pointer list-none font-semibold text-ink">¿Cómo se calcula la nota y qué es «bueno»?</summary>
            <div className="space-y-2 pt-3 leading-relaxed">
              <p>
                La nota junta lo que se puede medir de cada anuncio: gancho, retención, clics al enlace, costo por conversación (comparado con tus otros anuncios) y frecuencia. Cada parte suma 100 puntos si está bien, 60 si es aceptable y 20 si hay que mejorarla.
              </p>
              <p>
                Los valores de referencia son los que usa quien maneja anuncios a diario, no cifras que publique Meta: gancho {THRESHOLDS.hook.good}% o más, retención {THRESHOLDS.hold.good}% o más, clics {THRESHOLDS.ctr.good}% o más y frecuencia menor a {THRESHOLDS.frequency.watch}. Úsalos como guía y compáralos con tus propios resultados.
              </p>
              <p>Un anuncio con menos de 1.000 impresiones no recibe nota: todavía hay muy pocos datos.</p>
            </div>
          </details>
        </>
      );
    }
  }

  const audience = section.audience?.ok ? section.audience.data : null;
  const placements = section.placements?.ok ? section.placements.data : null;
  const hasWho = (audience && (audience.age.length || audience.gender.length)) || (placements && placements.length);

  return (
    <>
      {creativesBlock && (
        <Section title="Tus anuncios, uno por uno" subtitle={`${rangeLabel(range)} · los de mayor inversión. Cada uno con su gancho, su retención y qué hacer con él para mejorar.`}>
          {creativesBlock}
        </Section>
      )}

      {hasWho && (
        <Section title="¿A quién le llegan tus anuncios y dónde funcionan?" subtitle="Quiénes los ven, cuánto cuesta cada conversación con cada grupo y en qué lugar de Facebook e Instagram rinden mejor.">
          <div className="grid gap-4 lg:grid-cols-2">
            {audience && audience.age.length > 0 && <SegmentCard title="Por edad" subtitle="Cuánto invertiste en cada rango y qué te costó cada conversación." segments={audience.age} money={m} what="El grupo de edad" />}
            {audience && audience.gender.length > 0 && <SegmentCard title="Por género" subtitle="Quién ve tus anuncios y quién te escribe." segments={audience.gender} money={m} what="El grupo" />}
            {placements && placements.length > 0 && <SegmentCard title="Por lugar donde se mostró" subtitle="Reels, Historias, Feed… cada lugar rinde distinto. Pasa presupuesto al que mejor funciona." segments={placements} money={m} what="El lugar" />}
          </div>
          {section.audience && !section.audience.ok && <SectionError error={section.audience.error} />}
          <Note>Meta agrupa estas cifras por persona que vio el anuncio, no por cliente. Con pocas conversaciones las diferencias entre grupos pueden ser casualidad: decide con calma cuando cada grupo tenga al menos 3 conversaciones.</Note>
        </Section>
      )}
    </>
  );
}
