import type { SocialPost } from "@/lib/metaSocial";

// What to do with each ad and each piece of content, from the numbers a media
// buyer reads first: the hook (do they stop?), the hold (do they stay?), the
// click rate (do they act?) and the cost of a conversation (does it pay?).
// Pure functions on purpose: Meta's numbers go in, plain-language decisions
// come out, and the thresholds live in one place.
//
// The thresholds are rules of thumb used when buying ads, not numbers Meta
// publishes; the screens say so.

export type Level = "good" | "ok" | "weak";
export type Tone = "good" | "warn" | "bad";

export const THRESHOLDS = {
  /** % of impressions where the person stayed at least 3 seconds. */
  hook: { good: 30, ok: 20 },
  /** % of those who stayed 3 seconds that kept watching to ThruPlay (15 s or the end). */
  hold: { good: 30, ok: 15 },
  /** % of impressions that clicked through to the destination. */
  ctr: { good: 1, ok: 0.6 },
  frequency: { tired: 3.5, watch: 2.5 },
} as const;

/** Under this many impressions a percentage swings too much to judge. */
export const MIN_IMPRESSIONS = 1000;
/** Under this many 3-second views the share that keeps watching means little. */
export const MIN_VIDEO_VIEWS = 100;
/** Link clicks with no conversation after which the problem is "after the click". */
const CLICKS_WITHOUT_CONVERSATION = 30;

const AWARENESS = new Set(["OUTCOME_AWARENESS", "REACH", "BRAND_AWARENESS"]);

export type VideoStats = {
  /** People who watched at least 3 seconds. */
  views3s: number | null;
  thruplays: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p100: number | null;
  avgWatchSeconds: number | null;
};

export type CreativeNumbers = {
  objective?: string;
  impressions: number;
  reach: number;
  spend: number;
  linkClicks: number;
  conversations: number;
  purchases?: number;
  frequency: number | null;
  video: VideoStats | null;
};

const pct = (n: number | null | undefined, d: number | null | undefined) => (n == null || !d || d <= 0 ? null : (n / d) * 100);

export const levelOf = (value: number, t: { good: number; ok: number }): Level => (value >= t.good ? "good" : value >= t.ok ? "ok" : "weak");

/** Of every 100 impressions, how many stopped for 3 seconds or more. */
export const hookRate = (c: CreativeNumbers): number | null => (c.video ? pct(c.video.views3s, c.impressions) : null);

/** Of those who stopped, how many kept watching to ThruPlay. */
export function holdRate(c: CreativeNumbers): number | null {
  const v = c.video;
  if (!v || (v.views3s ?? 0) < MIN_VIDEO_VIEWS) return null;
  const r = pct(v.thruplays, v.views3s);
  return r == null ? null : Math.min(100, r);
}

export const linkClickRate = (c: CreativeNumbers): number | null => pct(c.linkClicks, c.impressions);
export const costPerConversation = (c: { spend: number; conversations: number }): number | null => (c.conversations > 0 ? c.spend / c.conversations : null);

export type RetentionStep = { label: string; pct: number };

/** Of the people who watched 3 seconds, how many reached each quarter of the video. */
export function retentionSteps(v: VideoStats | null): RetentionStep[] {
  if (!v || !v.views3s || v.views3s < MIN_VIDEO_VIEWS) return [];
  const base = v.views3s;
  const points: [string, number | null][] = [
    ["25%", v.p25],
    ["50%", v.p50],
    ["75%", v.p75],
    ["100%", v.p100],
  ];
  return points.filter((p): p is [string, number] => p[1] != null).map(([label, n]) => ({ label, pct: Math.min(100, (n / base) * 100) }));
}

const num1 = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n))).replace(".", ",");
const num2 = (n: number) => n.toFixed(2).replace(".", ",");

// ---- Score ----

export type FactorKey = "hook" | "hold" | "ctr" | "cost" | "frequency";
export type Factor = { key: FactorKey; label: string; level: Level; weight: number; value: number };

const POINTS: Record<Level, number> = { good: 100, ok: 60, weak: 20 };
const WEIGHTS: Record<FactorKey, number> = { hook: 25, hold: 20, ctr: 20, cost: 25, frequency: 10 };
const LABELS: Record<FactorKey, string> = { hook: "Gancho", hold: "Retención", ctr: "Clics al enlace", cost: "Costo por conversación", frequency: "Frecuencia" };

export type ScoreContext = {
  /** Average cost of a conversation across the account's ads (spend / conversations). */
  avgCostPerConversation: number | null;
  accountHasConversations: boolean;
};

export const hasEnoughData = (c: CreativeNumbers) => c.impressions >= MIN_IMPRESSIONS && c.spend > 0;

/** The measurable parts of an ad, each judged on its own. */
export function creativeFactors(c: CreativeNumbers, ctx: ScoreContext): Factor[] {
  const out: Factor[] = [];
  const add = (key: FactorKey, level: Level, value: number) => out.push({ key, label: LABELS[key], level, weight: WEIGHTS[key], value });

  const hook = hookRate(c);
  if (hook != null) add("hook", levelOf(hook, THRESHOLDS.hook), hook);
  const hold = holdRate(c);
  if (hold != null) add("hold", levelOf(hold, THRESHOLDS.hold), hold);
  const ctr = linkClickRate(c);
  if (ctr != null && !AWARENESS.has(c.objective ?? "")) add("ctr", levelOf(ctr, THRESHOLDS.ctr), ctr);

  const cost = costPerConversation(c);
  if (cost != null && ctx.avgCostPerConversation) {
    const ratio = cost / ctx.avgCostPerConversation;
    add("cost", ratio <= 0.8 ? "good" : ratio <= 1.25 ? "ok" : "weak", cost);
  } else if (c.conversations === 0 && ctx.accountHasConversations && c.linkClicks >= CLICKS_WITHOUT_CONVERSATION) {
    // Clicks arrive but nobody writes.
    add("cost", "weak", 0);
  }

  if (c.frequency != null) add("frequency", c.frequency >= THRESHOLDS.frequency.tired ? "weak" : c.frequency >= THRESHOLDS.frequency.watch ? "ok" : "good", c.frequency);
  return out;
}

/** 0-100 from the factors that exist (an image ad has no hook or hold); null with fewer than two. */
export function creativeScore(factors: Factor[]): number | null {
  if (factors.length < 2) return null;
  const weight = factors.reduce((a, f) => a + f.weight, 0);
  return Math.round(factors.reduce((a, f) => a + f.weight * POINTS[f.level], 0) / weight);
}

export function scoreLabel(score: number): string {
  return score >= 75 ? "Muy buena" : score >= 55 ? "Buena" : score >= 40 ? "Regular" : "Débil";
}

// ---- What to do ----

export type CreativeVerdict = "escalar" | "mantener" | "optimizar" | "reemplazar" | "poco_dato";
export type CreativeAction = { tone: Tone; text: string };
export type CreativeAdvice = { verdict: CreativeVerdict; verdictLabel: string; score: number | null; factors: Factor[]; actions: CreativeAction[]; bottleneck: FactorKey | null };

export const VERDICT_LABELS: Record<CreativeVerdict, string> = {
  escalar: "Escálalo",
  mantener: "Va bien",
  optimizar: "Mejóralo",
  reemplazar: "Reemplázalo",
  poco_dato: "Falta información",
};

// The order a person goes through an ad: stops, stays, clicks, writes.
const FUNNEL: FactorKey[] = ["hook", "hold", "ctr", "cost"];

function bottleneckAction(key: FactorKey, c: CreativeNumbers, f: Factor, weak: boolean): CreativeAction {
  const tone: Tone = weak ? "bad" : "warn";
  if (key === "hook") {
    return weak
      ? { tone, text: `Solo ${num1(f.value)} de cada 100 se detiene a verlo. Rehaz los primeros 3 segundos: empieza con una pregunta o con el resultado, muestra una cara y pon el texto grande en pantalla. Prueba 2 o 3 inicios distintos con el mismo video.` }
      : { tone, text: `El gancho es aceptable (${num1(f.value)} de cada 100 se detiene). Prueba otra primera frase o un primer plano más llamativo para pasar de ${THRESHOLDS.hook.good}.` };
  }
  if (key === "hold") {
    return weak
      ? { tone, text: `Se detienen, pero se van: solo ${num1(f.value)} de cada 100 llega a verlo completo. Acórtalo, di lo más importante en los primeros 10 segundos y agrega subtítulos.` }
      : { tone, text: `La retención es aceptable (${num1(f.value)} de cada 100 sigue hasta el final). Quita las partes lentas del medio para mejorarla.` };
  }
  if (key === "ctr") {
    return weak
      ? { tone, text: `Lo ven pero casi nadie hace clic (${num2(f.value)}%). Cierra con un llamado claro («Escríbenos por WhatsApp»), muestra el precio o la oferta y usa un botón visible.` }
      : { tone, text: `Los clics son aceptables (${num2(f.value)}%). Un llamado más directo al final puede subirlos de ${THRESHOLDS.ctr.good}%.` };
  }
  return f.value === 0
    ? { tone, text: `Hay ${c.linkClicks} clics y ninguna conversación. Revisa que el botón abra el WhatsApp correcto, que el mensaje de bienvenida responda rápido y que el público sea el que compra.` }
    : { tone, text: "Cada conversación sale más cara que en tus otros anuncios. Revisa el público y el mensaje que le llega a quien escribe, o pasa su presupuesto al anuncio que mejor rinde." };
}

export function adviseCreative(c: CreativeNumbers, ctx: ScoreContext): CreativeAdvice {
  if (!hasEnoughData(c)) {
    return {
      verdict: "poco_dato",
      verdictLabel: VERDICT_LABELS.poco_dato,
      score: null,
      factors: [],
      actions: [{ tone: "warn", text: "Todavía tiene muy pocas impresiones para sacar conclusiones. Déjalo correr unos días más antes de cambiarlo." }],
      bottleneck: null,
    };
  }
  const factors = creativeFactors(c, ctx);
  const score = creativeScore(factors);
  const weak = factors.filter((f) => f.level === "weak");
  const tired = factors.find((f) => f.key === "frequency" && f.level === "weak");

  let verdict: CreativeVerdict;
  if (score == null) verdict = "poco_dato";
  else if (score >= 75 && weak.length === 0) verdict = "escalar";
  else if (score < 45) verdict = "reemplazar";
  else verdict = weak.length > 0 || factors.some((f) => f.level === "ok" && f.key !== "frequency") ? "optimizar" : "mantener";

  const funnel = factors.filter((f) => FUNNEL.includes(f.key));
  const stuck = funnel.find((f) => f.level === "weak") ?? funnel.find((f) => f.level === "ok" && verdict !== "escalar") ?? null;
  const actions: CreativeAction[] = [];
  if (stuck) actions.push(bottleneckAction(stuck.key, c, stuck, stuck.level === "weak"));
  if (tired) {
    actions.push({ tone: "warn", text: `Cada persona ya lo vio ${num1(tired.value)} veces: se está cansando. Cambia la imagen o el video, o amplía el público.` });
  }
  if (verdict === "escalar") {
    actions.push({ tone: "good", text: "Es de lo mejor que tienes. Súbele el presupuesto de a poco (20% cada 3 o 4 días) y haz 2 versiones con otro inicio para no depender de uno solo." });
  }
  const hook = factors.find((f) => f.key === "hook" && f.level === "good");
  if (hook && actions.length < 3) actions.push({ tone: "good", text: `Su gancho funciona (${num1(hook.value)} de cada 100 se detiene). Repite ese tipo de inicio en tus próximos videos.` });
  const ctr = factors.find((f) => f.key === "ctr" && f.level === "good");
  if (ctr && actions.length < 3) actions.push({ tone: "good", text: `Mueve a la gente a actuar: ${num2(ctr.value)}% hace clic.` });
  if (actions.length === 0) actions.push({ tone: "good", text: "Sus números están dentro de lo normal. Déjalo correr y revísalo en unos días." });

  return { verdict, verdictLabel: VERDICT_LABELS[verdict], score, factors, actions: actions.slice(0, 3), bottleneck: stuck?.key ?? null };
}

/** The account-wide average cost of a conversation, to judge each ad against. */
export function scoreContext(rows: CreativeNumbers[]): ScoreContext {
  const spend = rows.filter((r) => r.conversations > 0).reduce((a, r) => a + r.spend, 0);
  const conversations = rows.reduce((a, r) => a + r.conversations, 0);
  return { avgCostPerConversation: conversations > 0 ? spend / conversations : null, accountHasConversations: conversations > 0 };
}

export type CreativeEntry = { name: string; numbers: CreativeNumbers; advice: CreativeAdvice };
export type Highlight = { tone: Tone; text: string };

/** Hook, hold and click rate of the whole account, each weighted by how many people it reached. */
export function accountCreativeKpis(rows: CreativeNumbers[]) {
  const videos = rows.filter((r) => r.video && r.impressions >= MIN_IMPRESSIONS);
  const imp = videos.reduce((a, r) => a + r.impressions, 0);
  const views3s = videos.reduce((a, r) => a + (r.video?.views3s ?? 0), 0);
  const holdBase = videos.filter((r) => holdRate(r) != null);
  const base3s = holdBase.reduce((a, r) => a + (r.video?.views3s ?? 0), 0);
  const thru = holdBase.reduce((a, r) => a + (r.video?.thruplays ?? 0), 0);
  const withCtr = rows.filter((r) => linkClickRate(r) != null && !AWARENESS.has(r.objective ?? ""));
  const ctrImp = withCtr.reduce((a, r) => a + r.impressions, 0);
  const clicks = withCtr.reduce((a, r) => a + r.linkClicks, 0);
  return {
    videos: videos.length,
    hook: imp > 0 && views3s > 0 ? (views3s / imp) * 100 : null,
    hold: base3s > 0 ? Math.min(100, (thru / base3s) * 100) : null,
    ctr: ctrImp > 0 ? (clicks / ctrImp) * 100 : null,
  };
}

/** The few things to do first with the whole set of ads. */
export function creativeHighlights(entries: CreativeEntry[], money: (n: number) => string): Highlight[] {
  const out: Highlight[] = [];
  const judged = entries.filter((e) => e.advice.score != null);

  const videos = judged.filter((e) => e.advice.factors.some((f) => f.key === "hook"));
  const weakHooks = videos.filter((e) => e.advice.factors.some((f) => f.key === "hook" && f.level === "weak"));
  if (videos.length >= 2 && weakHooks.length * 2 >= videos.length) {
    out.push({ tone: "bad", text: `En ${weakHooks.length} de tus ${videos.length} videos menos de ${THRESHOLDS.hook.ok} de cada 100 personas se detiene. Lo que más te conviene mejorar son los primeros 3 segundos.` });
  }

  const worst = judged.filter((e) => e.advice.verdict === "reemplazar").sort((a, b) => b.numbers.spend - a.numbers.spend)[0];
  if (worst) out.push({ tone: "bad", text: `«${worst.name}» ya gastó ${money(worst.numbers.spend)} y su nota es ${worst.advice.score}: reemplázalo por una versión nueva.` });

  const best = judged.filter((e) => e.advice.verdict === "escalar").sort((a, b) => (b.advice.score ?? 0) - (a.advice.score ?? 0))[0];
  if (best) out.push({ tone: "good", text: `«${best.name}» es tu mejor anuncio (nota ${best.advice.score}). Súbele el presupuesto de a poco y copia su inicio en los siguientes.` });

  const tired = judged.filter((e) => e.advice.factors.some((f) => f.key === "frequency" && f.level === "weak"));
  if (tired.length > 0) out.push({ tone: "warn", text: `${tired.length === 1 ? "1 anuncio ya cansó" : `${tired.length} anuncios ya cansaron`} a su público: cámbiales la imagen o el video.` });

  return out.slice(0, 4);
}

// ---- Who sees the ads ----

export type Segment = { key: string; label: string; impressions: number; spend: number; linkClicks: number; conversations: number };
export type SegmentRead = Segment & { spendShare: number; conversationShare: number; cost: number | null };
export type SegmentsReading = { rows: SegmentRead[]; unit: "conversación" | "clic" | null; best: SegmentRead | null; worst: SegmentRead | null };

const MIN_CONVERSATIONS_TO_COMPARE = 5;

/** Each group with what it cost and what it brought, and which ones to favour or drop. */
export function readSegments(segments: Segment[]): SegmentsReading {
  const totalSpend = segments.reduce((a, s) => a + s.spend, 0);
  const totalConv = segments.reduce((a, s) => a + s.conversations, 0);
  const totalClicks = segments.reduce((a, s) => a + s.linkClicks, 0);
  const unit = totalConv >= MIN_CONVERSATIONS_TO_COMPARE ? "conversación" : totalClicks >= 20 ? "clic" : null;
  const countOf = (s: Segment) => (unit === "conversación" ? s.conversations : s.linkClicks);
  const rows: SegmentRead[] = segments
    .filter((s) => s.spend > 0 || s.impressions > 0)
    .map((s) => ({
      ...s,
      spendShare: totalSpend > 0 ? s.spend / totalSpend : 0,
      conversationShare: totalConv > 0 ? s.conversations / totalConv : 0,
      cost: unit && countOf(s) > 0 ? s.spend / countOf(s) : null,
    }))
    .sort((a, b) => b.spend - a.spend);
  if (!unit) return { rows, unit, best: null, worst: null };

  const totalCount = unit === "conversación" ? totalConv : totalClicks;
  const avg = totalCount > 0 ? totalSpend / totalCount : null;
  const minCount = unit === "conversación" ? 3 : 10;
  const best = rows.filter((r) => countOf(r) >= minCount && r.spendShare >= 0.05 && r.cost != null).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0] ?? null;
  const worst =
    rows
      .filter((r) => r.spendShare >= 0.1 && (countOf(r) === 0 || (avg != null && r.cost != null && r.cost >= avg * 1.5)))
      .sort((a, b) => (countOf(a) === 0 ? 1 : 0) - (countOf(b) === 0 ? 1 : 0) || b.spend - a.spend)[0] ?? null;
  return { rows, unit, best: best && best !== worst ? best : null, worst };
}

export function segmentTips(reading: SegmentsReading, money: (n: number) => string, what: string): Highlight[] {
  const { best, worst, unit } = reading;
  const out: Highlight[] = [];
  if (best && unit) out.push({ tone: "good", text: `${what} que mejor te rinde: ${best.label}. Cada ${unit} te cuesta ${money(best.cost ?? 0)}. Dirígeles más presupuesto.` });
  if (worst && unit) {
    out.push({
      tone: "bad",
      text:
        worst.cost == null
          ? `${worst.label}: se llevó ${Math.round(worst.spendShare * 100)}% de tu inversión y no trajo ninguna ${unit}. Reduce o quita lo que inviertes ahí.`
          : `${worst.label}: cada ${unit} te cuesta ${money(worst.cost)}, mucho más que en el resto. Reduce lo que inviertes ahí.`,
    });
  }
  return out;
}

// ---- Organic content ----

export type VideoRead = {
  post: SocialPost;
  watchSeconds: number;
  /** Watch time against the median of the account's other videos. */
  versus: "above" | "similar" | "below";
  savesPer1000: number | null;
  sharesPer1000: number | null;
  tips: Highlight[];
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
/** "8 nov", in Colombia time (no DST). */
const dayLabel = (iso: string) => {
  const d = new Date(Date.parse(iso) - 5 * 3_600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const base = (p: SocialPost) => p.reach ?? p.views;
export const per1000 = (n: number | null | undefined, p: SocialPost): number | null => {
  const b = base(p);
  return n == null || !b || b <= 0 ? null : (n / b) * 1000;
};

/** Each video with how long people watch it and how often it's saved or shared, against the account's own average. */
export function readOrganicVideos(posts: SocialPost[]): { rows: VideoRead[]; medianWatch: number | null } {
  const videos = posts.filter((p) => p.watchSeconds != null && p.watchSeconds > 0);
  const medianWatch = median(videos.map((p) => p.watchSeconds as number));
  const medSaves = median(posts.map((p) => per1000(p.saves, p)).filter((x): x is number => x != null && x > 0));
  const medShares = median(posts.map((p) => per1000(p.shares, p)).filter((x): x is number => x != null && x > 0));
  const rows = videos
    .map((post): VideoRead => {
      const watchSeconds = post.watchSeconds as number;
      const ratio = medianWatch ? watchSeconds / medianWatch : 1;
      const versus = videos.length < 3 ? "similar" : ratio >= 1.25 ? "above" : ratio <= 0.75 ? "below" : "similar";
      const savesPer1000 = per1000(post.saves, post);
      const sharesPer1000 = per1000(post.shares, post);
      const tips: Highlight[] = [];
      if (versus === "above") tips.push({ tone: "good", text: "La gente lo ve más tiempo que tus otros videos. Repite su inicio y su tema." });
      if (versus === "below") tips.push({ tone: "bad", text: "La gente se va rápido. Pon lo más importante en el primer segundo y acórtalo." });
      if (sharesPer1000 != null && medShares && sharesPer1000 >= medShares * 1.5) tips.push({ tone: "good", text: "Lo comparten más que el resto: es el contenido que hace crecer tu cuenta." });
      if (savesPer1000 != null && medSaves && savesPer1000 >= medSaves * 1.5) tips.push({ tone: "good", text: "Lo guardan para volver: les sirve. Haz más sobre este tema." });
      return { post, watchSeconds, versus, savesPer1000, sharesPer1000, tips };
    })
    .sort((a, b) => b.watchSeconds - a.watchSeconds);
  return { rows, medianWatch };
}

export type FormatRow = { type: string; count: number; avgViews: number | null; avgInteractions: number; rate: number | null };

/** Which kind of post (Reel, Foto, Carrusel…) gets the most reaction per view. */
export function formatPerformance(posts: SocialPost[]): FormatRow[] {
  const groups = new Map<string, SocialPost[]>();
  for (const p of posts) groups.set(p.type, [...(groups.get(p.type) ?? []), p]);
  return [...groups.entries()]
    .map(([type, list]) => {
      const withViews = list.filter((p) => p.views);
      const views = withViews.reduce((a, p) => a + (p.views ?? 0), 0);
      return {
        type,
        count: list.length,
        avgViews: withViews.length ? views / withViews.length : null,
        avgInteractions: list.reduce((a, p) => a + p.interactions, 0) / list.length,
        rate: views > 0 ? (withViews.reduce((a, p) => a + p.interactions, 0) / views) * 100 : null,
      };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

/** What to do with the organic content, from the formats and the videos. */
export function organicHighlights(posts: SocialPost[]): Highlight[] {
  const out: Highlight[] = [];
  const formats = formatPerformance(posts).filter((f) => f.count >= 2 && f.rate != null);
  if (formats.length >= 2) {
    const [top, ...rest] = formats;
    const last = rest[rest.length - 1];
    if (last.rate != null && top.rate != null && last.rate > 0 && top.rate / last.rate >= 1.3) {
      out.push({ tone: "good", text: `Tus ${top.type.toLowerCase()}s generan ${num1(top.rate / last.rate)} veces más reacción por cada vista que tus ${last.type.toLowerCase()}s. Publica más de ${top.type.toLowerCase()}s.` });
    }
  }
  const { rows, medianWatch } = readOrganicVideos(posts);
  if (rows.length >= 3 && medianWatch != null) {
    const best = rows[0];
    const worst = rows[rows.length - 1];
    if (best.versus === "above") out.push({ tone: "good", text: `Tu video que más retiene se ve ${num1(best.watchSeconds)} segundos en promedio, frente a ${num1(medianWatch)} del resto. Copia su inicio.` });
    if (worst.versus === "below") out.push({ tone: "warn", text: `Uno de tus videos solo se ve ${num1(worst.watchSeconds)} segundos en promedio. Si varios son así, cambia cómo empiezan.` });
  }
  const shared = [...posts].map((p) => ({ p, v: per1000(p.shares, p) })).filter((x): x is { p: SocialPost; v: number } => x.v != null && x.v > 0).sort((a, b) => b.v - a.v)[0];
  if (shared && posts.length >= 4) {
    out.push({ tone: "good", text: `Lo que más compartieron fue tu ${shared.p.type.toLowerCase()} del ${dayLabel(shared.p.publishedAt)}: compartir es lo que te trae gente nueva. Haz más como ese.` });
  }
  if (posts.length < 4) out.push({ tone: "warn", text: "Hay pocas publicaciones en este período para sacar patrones. Elige fechas más largas o publica un poco más." });
  return out.slice(0, 4);
}
