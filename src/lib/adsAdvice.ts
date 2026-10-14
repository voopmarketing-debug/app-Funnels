import { cpm, frequency, linkCtr, type AdCampaign, type AdTotals } from "@/lib/metaSocial";

// What to do with each campaign, from its numbers compared with the rest of
// the account. Rules of thumb a media buyer applies by eye, written down so
// a business owner gets the same read: scale what's cheap, fix what's
// tired or ignored, stop what spends without results.

export type CampaignVerdict = "escalar" | "mantener" | "optimizar" | "pausar" | "poco_dato";
export type CampaignTip = { tone: "good" | "warn" | "bad"; text: string };
export type CampaignAdvice = { verdict: CampaignVerdict; tips: CampaignTip[] };

/** Below this many impressions the percentages swing too much to judge. */
const MIN_IMPRESSIONS = 1000;
const FATIGUE_FREQUENCY = 3.5;
const LOW_LINK_CTR = 0.7;
const GOOD_LINK_CTR = 1.5;

const costPerResult = (c: AdCampaign) => (c.results ? c.spend / c.results : null);

/** Average cost per result across campaigns of the same objective (results are only comparable within one). */
function averageCostPerResult(campaigns: AdCampaign[], objective: string): number | null {
  const same = campaigns.filter((c) => c.objective === objective && c.results);
  const spend = same.reduce((a, c) => a + c.spend, 0);
  const results = same.reduce((a, c) => a + (c.results ?? 0), 0);
  return results > 0 && same.length > 1 ? spend / results : null;
}

const pct = (ratio: number) => `${Math.round(Math.abs(ratio - 1) * 100)}%`;

export function adviseCampaign(c: AdCampaign, all: AdCampaign[], account: AdTotals): CampaignAdvice {
  if (c.impressions < MIN_IMPRESSIONS || c.spend <= 0) {
    return { verdict: "poco_dato", tips: [{ tone: "warn", text: "Todavía tiene muy pocas impresiones para sacar conclusiones. Déjala correr unos días más." }] };
  }

  const tips: CampaignTip[] = [];
  let score = 0;

  // Spent a real share of the budget and got nothing back.
  const totalSpend = all.reduce((a, x) => a + x.spend, 0);
  if (c.results === 0 && totalSpend > 0 && c.spend / totalSpend >= 0.1) {
    tips.push({ tone: "bad", text: "Gastó una parte importante del presupuesto sin conseguir ningún resultado. Pausa y revisa el anuncio, el público o el objetivo." });
    score -= 3;
  }

  const cpr = costPerResult(c);
  const avgCpr = averageCostPerResult(all, c.objective);
  if (cpr != null && avgCpr != null) {
    const ratio = cpr / avgCpr;
    if (ratio >= 1.5) {
      tips.push({ tone: "bad", text: `Cada resultado te cuesta ${pct(ratio)} más que en tus otras campañas parecidas. Baja su presupuesto o pásalo a la que mejor rinde.` });
      score -= 2;
    } else if (ratio <= 0.7) {
      tips.push({ tone: "good", text: `Es de tus campañas más baratas: cada resultado cuesta ${pct(ratio)} menos que el promedio. Súbele el presupuesto de a poco (20% cada 3-4 días).` });
      score += 2;
    }
  }

  const f = frequency(c);
  if (f != null && f >= FATIGUE_FREQUENCY) {
    tips.push({ tone: "warn", text: `Cada persona ya vio el anuncio ${f.toFixed(1).replace(".", ",")} veces en promedio: se está cansando. Cambia la imagen o el video, o amplía el público.` });
    score -= 1;
  }

  // Awareness campaigns are bought to be seen, not clicked.
  const lctr = c.objective === "OUTCOME_AWARENESS" ? null : linkCtr(c);
  if (lctr != null) {
    if (lctr < LOW_LINK_CTR) {
      tips.push({ tone: "warn", text: `Solo ${lctr.toFixed(2).replace(".", ",")}% de quienes lo ven hacen clic. Prueba otro gancho en los primeros segundos y un llamado más directo ("Escríbenos por WhatsApp").` });
      score -= 1;
    } else if (lctr >= GOOD_LINK_CTR) {
      tips.push({ tone: "good", text: `El anuncio llama la atención: ${lctr.toFixed(2).replace(".", ",")}% hace clic, por encima de lo normal (alrededor de 1%).` });
      score += 1;
    }
  }

  const campaignCpm = cpm(c);
  const accountCpm = cpm(account);
  if (campaignCpm != null && accountCpm != null && campaignCpm / accountCpm >= 1.5) {
    tips.push({ tone: "warn", text: `Llegar a la gente aquí cuesta ${pct(campaignCpm / accountCpm)} más que en el resto de tu cuenta. Suele pasar con públicos muy pequeños: amplíalo un poco.` });
    score -= 1;
  }

  const verdict: CampaignVerdict = score <= -3 ? "pausar" : score < 0 ? "optimizar" : score >= 2 ? "escalar" : "mantener";
  if (tips.length === 0) tips.push({ tone: "good", text: "Sus números están dentro de lo normal para tu cuenta. Mantenla y revisa en unos días." });
  return { verdict, tips };
}

export const VERDICT_LABELS: Record<CampaignVerdict, string> = {
  escalar: "Súbele presupuesto",
  mantener: "Va bien",
  optimizar: "Ajústala",
  pausar: "Pausa o rehaz",
  poco_dato: "Falta información",
};

// ---- In plain words ----
// "Resultados" means nothing to a business owner: each campaign is shown with
// what it actually got (conversations, clicks, sales…) and what each one cost.

export type CampaignOutcome = {
  count: number | null;
  /** "conversaciones", "clics a tu enlace"… */
  plural: string;
  singular: string;
  /** What the campaign was bought for, e.g. "conseguir clientes potenciales". */
  goal: string;
  /** Cost of one, or of 1.000 people reached for awareness campaigns. */
  cost: number | null;
  costLabel: string;
};

type OutcomeKind = { goal: string; plural: string; singular: string; count: (c: AdCampaign) => number | null };

const RESULTS = (c: AdCampaign) => c.results;
const KINDS: Record<string, OutcomeKind> = {
  leads: { goal: "conseguir clientes potenciales", plural: "clientes potenciales", singular: "cliente potencial", count: RESULTS },
  sales: { goal: "vender", plural: "ventas", singular: "venta", count: (c) => (c.purchases ? c.purchases : c.results) },
  traffic: { goal: "llevar gente a tu enlace", plural: "clics a tu enlace", singular: "clic", count: (c) => c.linkClicks ?? c.results },
  engagement: { goal: "conseguir interacciones", plural: "interacciones", singular: "interacción", count: RESULTS },
  messages: { goal: "recibir mensajes", plural: "conversaciones", singular: "conversación", count: (c) => c.conversations ?? c.results },
  video: { goal: "que vean tu video", plural: "reproducciones", singular: "reproducción", count: RESULTS },
  likes: { goal: "ganar seguidores", plural: "me gusta", singular: "me gusta", count: RESULTS },
  app: { goal: "instalar tu app", plural: "instalaciones", singular: "instalación", count: RESULTS },
};
const KIND_OF: Record<string, keyof typeof KINDS | "awareness"> = {
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  OUTCOME_SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "sales",
  OUTCOME_TRAFFIC: "traffic",
  LINK_CLICKS: "traffic",
  OUTCOME_ENGAGEMENT: "engagement",
  POST_ENGAGEMENT: "engagement",
  MESSAGES: "messages",
  VIDEO_VIEWS: "video",
  PAGE_LIKES: "likes",
  OUTCOME_APP_PROMOTION: "app",
  APP_INSTALLS: "app",
  OUTCOME_AWARENESS: "awareness",
  REACH: "awareness",
  BRAND_AWARENESS: "awareness",
};

export function campaignOutcome(c: AdCampaign): CampaignOutcome {
  const kind = KIND_OF[c.objective];
  // A WhatsApp conversation is what these businesses sell through: it wins
  // over the objective's own result whenever the campaign started any.
  if (c.conversations && kind !== "awareness") {
    return {
      count: c.conversations,
      plural: "conversaciones",
      singular: "conversación",
      goal: kind ? KINDS[kind].goal : "recibir mensajes",
      cost: c.spend / c.conversations,
      costLabel: "Cada conversación te costó",
    };
  }
  if (kind === "awareness") {
    return {
      count: c.reach,
      plural: "personas alcanzadas",
      singular: "persona alcanzada",
      goal: "que mucha gente te conozca",
      cost: c.reach > 0 ? (c.spend / c.reach) * 1000 : null,
      costLabel: "Llegar a 1.000 personas te costó",
    };
  }
  const k = kind ? KINDS[kind] : { goal: "conseguir resultados", plural: "resultados", singular: "resultado", count: (x: AdCampaign) => x.results ?? x.linkClicks ?? null };
  const count = k.count(c);
  return { count, plural: k.plural, singular: k.singular, goal: k.goal, cost: count ? c.spend / count : null, costLabel: `Cada ${k.singular} te costó` };
}

export type AdsHighlight = { tone: "good" | "warn" | "bad"; text: string };

const isActive = (c: AdCampaign) => c.status === "ACTIVE";

/** The two or three things to do first with the whole account, best ordered for a busy owner. */
export function adsHighlights(campaigns: AdCampaign[], account: AdTotals, money: (n: number) => string): AdsHighlight[] {
  const out: AdsHighlight[] = [];
  const advised = campaigns.map((c) => ({ c, advice: adviseCampaign(c, campaigns, account), outcome: campaignOutcome(c) }));
  const byActiveThenSpend = (a: (typeof advised)[number], b: (typeof advised)[number]) => Number(isActive(b.c)) - Number(isActive(a.c)) || b.c.spend - a.c.spend;

  const worst = advised.filter((x) => x.advice.verdict === "pausar").sort(byActiveThenSpend)[0];
  if (worst) {
    const n = worst.outcome.count;
    const got = n ? `y solo consiguió ${n} ${n === 1 ? worst.outcome.singular : worst.outcome.plural}` : `sin conseguir ${worst.outcome.plural}`;
    out.push({ tone: "bad", text: `${isActive(worst.c) ? "Pausa o cambia" : "No repitas"} «${worst.c.name}»: gastó ${money(worst.c.spend)} ${got}.` });
  }

  // Only compare like with like: when any campaign brought conversations,
  // the best one is the cheapest per conversation, not per click.
  const unit = advised.some((x) => x.outcome.plural === "conversaciones") ? "conversaciones" : null;
  const best = advised
    .filter((x) => (x.advice.verdict === "escalar" || x.advice.verdict === "mantener") && x.outcome.cost != null && x.outcome.count)
    .filter((x) => !unit || x.outcome.plural === unit)
    .sort((a, b) => Number(isActive(b.c)) - Number(isActive(a.c)) || (a.outcome.cost ?? 0) - (b.outcome.cost ?? 0))[0];
  if (best) {
    out.push({
      tone: "good",
      text: `Tu campaña que mejor rinde es «${best.c.name}»: ${best.outcome.costLabel.toLowerCase()} ${money(best.outcome.cost!)}. ${
        isActive(best.c) ? "Súbele el presupuesto de a poco (20% cada 3-4 días)." : "Úsala como modelo para tu próxima campaña."
      }`,
    });
  }

  const f = frequency(account);
  if (f != null && f >= FATIGUE_FREQUENCY) {
    out.push({ tone: "warn", text: `La misma gente ya vio tus anuncios ${f.toFixed(1).replace(".", ",")} veces en promedio: cambia las imágenes o los videos para que no se cansen.` });
  }

  if (campaigns.length > 0 && !campaigns.some(isActive) && campaigns.some((c) => c.status)) {
    out.push({ tone: "warn", text: "Ahora mismo no tienes ninguna campaña encendida: si quieres seguir recibiendo clientes por anuncios, activa la que mejor te funcionó." });
  }
  return out.slice(0, 3);
}
