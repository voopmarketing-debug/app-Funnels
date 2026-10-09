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
