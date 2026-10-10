import crypto from "node:crypto";

// Facebook Page, Instagram and Meta Ads data for the "Redes sociales" module,
// read from Meta's Graph API with the tokens saved on SocialConnection.
// Meta renames and retires insight metrics from time to time, so every
// metric is asked for with fallbacks (first one Meta accepts wins) and a
// metric Meta refuses leaves that number empty instead of failing the page.

const GRAPH = "https://graph.facebook.com/v21.0";

export const META_SOCIAL_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "ads_read",
  "business_management",
  // The Mensajes inbox (Messenger + Instagram Direct, answered by people).
  "pages_messaging",
  "pages_manage_metadata",
  "instagram_manage_messages",
];

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
  /** The token expired or was revoked: the business has to connect again. */
  get needsReconnect(): boolean {
    return this.code === 190 || this.code === 102;
  }
}

export function metaRedirectUri(): string {
  return `https://${process.env.APP_HOST ?? "agente.funnelslabs.app"}/api/social/meta/callback`;
}

// ---- OAuth state (signed, so the callback knows which business it's for) ----

function stateKey(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function signState(payload: { businessId: string; userId: string }): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { businessId: string; userId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { businessId: string; userId: string; exp: number };
    return data.exp > Date.now() ? { businessId: data.businessId, userId: data.userId } : null;
  } catch {
    return null;
  }
}

export function metaLoginUrl(state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  // Business-type Meta apps use "Facebook Login for Business", where the
  // permissions live in a saved configuration instead of the scope list.
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
  if (configId) url.searchParams.set("config_id", configId);
  else url.searchParams.set("scope", META_SOCIAL_SCOPES.join(","));
  return url.toString();
}

// ---- Graph helpers ----

type GraphError = { error?: { message?: string; code?: number; error_user_msg?: string } };

export async function graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    throw new MetaApiError(json.error?.error_user_msg || json.error?.message || `Meta respondió ${res.status}`, json.error?.code);
  }
  return json;
}

/** Follows `paging.next` up to `maxPages`. */
export async function graphAll<T>(path: string, params: Record<string, string>, token: string, maxPages = 5): Promise<T[]> {
  const out: T[] = [];
  let page = await graph<{ data: T[]; paging?: { next?: string } }>(path, params, token);
  out.push(...page.data);
  for (let i = 1; i < maxPages && page.paging?.next; i++) {
    page = await graph<{ data: T[]; paging?: { next?: string } }>(page.paging.next, {}, token);
    out.push(...page.data);
  }
  return out;
}

export async function exchangeCodeForToken(code: string): Promise<{ token: string; expiresAt: Date | null }> {
  const appId = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  const short = await graph<{ access_token: string }>(
    "oauth/access_token",
    { client_id: appId, client_secret: appSecret, redirect_uri: metaRedirectUri(), code },
    "",
  );
  const long = await graph<{ access_token: string; expires_in?: number }>(
    "oauth/access_token",
    { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token },
    "",
  );
  return { token: long.access_token, expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null };
}

export type MetaPage = { id: string; name: string; accessToken: string; igUserId: string | null; igUsername: string | null };
export type MetaAdAccount = { id: string; name: string; currency: string; active: boolean; spent: number };

export async function listPages(userToken: string): Promise<MetaPage[]> {
  const rows = await graphAll<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }>(
    "me/accounts",
    { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100" },
    userToken,
  );
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    igUserId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }));
}

export async function listAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
  const rows = await graphAll<{ id: string; name?: string; currency: string; account_status: number; amount_spent?: string }>(
    "me/adaccounts",
    { fields: "id,name,currency,account_status,amount_spent", limit: "100" },
    userToken,
  );
  return rows.map((a) => {
    const digits = a.id.replace(/^act_/, "");
    // Accounts never renamed come back named with their bare number.
    const named = a.name && a.name !== digits ? a.name : `Cuenta publicitaria …${digits.slice(-4)}`;
    return { id: a.id, name: named, currency: a.currency, active: a.account_status === 1, spent: Number(a.amount_spent ?? 0) || 0 };
  });
}

/** The Page to measure when the owner didn't pick: one with Instagram linked, else the first. */
export function defaultPage(pages: MetaPage[]): MetaPage | null {
  return pages.find((p) => p.igUserId) ?? pages[0] ?? null;
}

/** The ad account to measure when the owner didn't pick: the active one that has spent the most. */
export function defaultAdAccount(accounts: MetaAdAccount[]): MetaAdAccount | null {
  const pool = accounts.some((a) => a.active) ? accounts.filter((a) => a.active) : accounts;
  return [...pool].sort((a, b) => b.spent - a.spent)[0] ?? null;
}

// ---- Dates ----

export type DayRange = { since: string; until: string }; // inclusive, YYYY-MM-DD

const DAY_MS = 86_400_000;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return ymd(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
}

export function daysIn(range: DayRange): string[] {
  const out: string[] = [];
  for (let d = range.since; d <= range.until; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The last `days` complete days (today excluded: its numbers are still moving), in Colombia time. */
export function lastDays(days: number, now = new Date()): DayRange {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
  const until = addDays(today, -1);
  return { since: addDays(until, -(days - 1)), until };
}

export function previousRange(range: DayRange): DayRange {
  const len = daysIn(range).length;
  return { since: addDays(range.since, -len), until: addDays(range.since, -1) };
}

const unix = (day: string, endOfDay = false) => String(Math.floor(Date.parse(`${day}T${endOfDay ? "23:59:59" : "00:00:00"}-05:00`) / 1000));

// ---- Account (followers, views, engagement) ----

export type Series = Record<string, number>; // day -> value

type InsightRow = { name: string; values: { value: number | Record<string, number>; end_time: string }[] };

// Meta stamps each daily value with the END of that day; the day it
// describes is the one before.
function seriesFrom(row: InsightRow | undefined): Series {
  const out: Series = {};
  for (const v of row?.values ?? []) {
    const n = typeof v.value === "number" ? v.value : Object.values(v.value ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
    out[addDays(v.end_time.slice(0, 10), -1)] = n;
  }
  return out;
}

/** First metric name Meta accepts for this object, as a daily series. Chunked to Meta's 30-day window. */
async function dailyMetric(objectId: string, candidates: string[], range: DayRange, token: string): Promise<Series | null> {
  const chunks: DayRange[] = [];
  for (let start = range.since; start <= range.until; start = addDays(start, 30)) {
    chunks.push({ since: start, until: addDays(start, 29) < range.until ? addDays(start, 29) : range.until });
  }
  for (const metric of candidates) {
    // A chunk Meta refuses (e.g. older than the metric's history) just stays
    // empty; the metric counts as accepted if any chunk came back.
    const results = await Promise.all(
      chunks.map((c) =>
        graph<{ data: InsightRow[] }>(`${objectId}/insights`, { metric, period: "day", since: unix(c.since), until: unix(addDays(c.until, 1)) }, token).catch((err) => {
          if (err instanceof MetaApiError && err.needsReconnect) throw err;
          return null;
        }),
      ),
    );
    if (results.some((r) => r)) return Object.assign({}, ...results.map((r) => seriesFrom(r?.data[0])));
  }
  return null;
}

/** A metric Meta only gives as one total for the whole range. */
async function totalMetric(objectId: string, candidates: string[], range: DayRange, token: string): Promise<number | null> {
  for (const metric of candidates) {
    try {
      const res = await graph<{ data: { total_value?: { value: number } }[] }>(
        `${objectId}/insights`,
        { metric, period: "day", metric_type: "total_value", since: unix(range.since), until: unix(range.until, true) },
        token,
      );
      const v = res.data[0]?.total_value?.value;
      if (typeof v === "number") return v;
    } catch (err) {
      if (err instanceof MetaApiError && err.needsReconnect) throw err;
    }
  }
  return null;
}

export const sum = (s: Series | null) => (s ? Object.values(s).reduce((a, b) => a + b, 0) : null);

export type NetworkAccount = {
  followers: number | null;
  followersSeries: Series;
  views: Series | null;
  viewsTotal: number | null;
  engagement: Series | null;
  engagementTotal: number | null;
};

export async function facebookAccount(pageId: string, pageToken: string, range: DayRange): Promise<NetworkAccount> {
  const [info, follows, views, engagement] = await Promise.all([
    graph<{ followers_count?: number; fan_count?: number }>(pageId, { fields: "followers_count,fan_count" }, pageToken),
    dailyMetric(pageId, ["page_follows", "page_fans"], range, pageToken),
    dailyMetric(pageId, ["page_media_view", "page_impressions"], range, pageToken),
    dailyMetric(pageId, ["page_post_engagements"], range, pageToken),
  ]);
  return {
    followers: info.followers_count ?? info.fan_count ?? null,
    followersSeries: follows ?? {},
    views,
    viewsTotal: sum(views),
    engagement,
    engagementTotal: sum(engagement),
  };
}

export async function instagramAccount(igUserId: string, pageToken: string, range: DayRange): Promise<NetworkAccount> {
  const [info, newFollowers, reach] = await Promise.all([
    graph<{ followers_count?: number }>(igUserId, { fields: "followers_count" }, pageToken),
    // Daily NEW followers; Meta keeps only the last 30 days.
    dailyMetric(igUserId, ["follower_count"], range, pageToken),
    // Instagram's views only come as a range total (instagramTotals); reach is the daily series.
    dailyMetric(igUserId, ["reach"], range, pageToken),
  ]);
  // Rebuild the daily total backwards from today's count.
  const followersSeries: Series = {};
  if (info.followers_count != null && newFollowers && Object.keys(newFollowers).length > 0) {
    let running = info.followers_count;
    for (const day of daysIn(range).reverse()) {
      followersSeries[day] = running;
      running -= newFollowers[day] ?? 0;
    }
  }
  return { followers: info.followers_count ?? null, followersSeries, views: reach, viewsTotal: null, engagement: null, engagementTotal: null };
}

/** Instagram views and interactions over a range (Meta gives them only as totals). */
export async function instagramTotals(igUserId: string, pageToken: string, range: DayRange): Promise<{ views: number | null; interactions: number | null }> {
  const [views, interactions] = await Promise.all([
    totalMetric(igUserId, ["views", "impressions"], range, pageToken),
    totalMetric(igUserId, ["total_interactions"], range, pageToken),
  ]);
  return { views, interactions };
}

// ---- Posts ----

export type SocialPost = {
  id: string;
  network: "facebook" | "instagram";
  text: string;
  type: string; // "Foto", "Video", "Reel", "Carrusel", "Texto"…
  publishedAt: string; // ISO
  permalink: string | null;
  thumbnail: string | null;
  views: number | null;
  interactions: number;
};

async function firstPostMetric(postId: string, candidates: string[], token: string): Promise<number | null> {
  for (const metric of candidates) {
    try {
      const res = await graph<{ data: { values?: { value: number }[]; total_value?: { value: number } }[] }>(`${postId}/insights`, { metric }, token);
      const row = res.data[0];
      const v = row?.total_value?.value ?? row?.values?.[0]?.value;
      if (typeof v === "number") return v;
    } catch (err) {
      if (err instanceof MetaApiError && err.needsReconnect) throw err;
    }
  }
  return null;
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const MAX_POSTS = 60;

export async function facebookPosts(pageId: string, pageToken: string, range: DayRange): Promise<SocialPost[]> {
  const rows = await graphAll<{
    id: string;
    message?: string;
    created_time: string;
    permalink_url?: string;
    full_picture?: string;
    status_type?: string;
    shares?: { count: number };
    reactions?: { summary?: { total_count: number } };
    comments?: { summary?: { total_count: number } };
  }>(
    `${pageId}/posts`,
    {
      fields: "id,message,created_time,permalink_url,full_picture,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
      since: unix(range.since),
      until: unix(range.until, true),
      limit: "50",
    },
    pageToken,
    2,
  );
  const posts = rows.slice(0, MAX_POSTS);
  const views = await inBatches(posts, 8, (p) => firstPostMetric(p.id, ["post_media_view", "post_impressions"], pageToken));
  return posts.map((p, i) => ({
    id: p.id,
    network: "facebook",
    text: p.message ?? "",
    type: p.status_type === "added_video" ? "Video" : p.full_picture ? "Foto" : "Texto",
    publishedAt: p.created_time,
    permalink: p.permalink_url ?? null,
    thumbnail: p.full_picture ?? null,
    views: views[i],
    interactions: (p.reactions?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0),
  }));
}

const IG_TYPES: Record<string, string> = { IMAGE: "Foto", VIDEO: "Video", CAROUSEL_ALBUM: "Carrusel", REELS: "Reel", STORY: "Historia" };

export async function instagramPosts(igUserId: string, pageToken: string, range: DayRange): Promise<SocialPost[]> {
  const sinceMs = Date.parse(`${range.since}T00:00:00-05:00`);
  const untilMs = Date.parse(`${range.until}T23:59:59-05:00`);
  const rows = await graphAll<{
    id: string;
    caption?: string;
    media_type: string;
    media_product_type?: string;
    permalink?: string;
    thumbnail_url?: string;
    media_url?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  }>(
    `${igUserId}/media`,
    { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count", limit: "50" },
    pageToken,
    3,
  );
  const posts = rows
    .filter((m) => {
      const t = Date.parse(m.timestamp);
      return t >= sinceMs && t <= untilMs;
    })
    .slice(0, MAX_POSTS);
  const extra = await inBatches(posts, 6, async (m) => {
    const [views, saved, shares] = await Promise.all([
      firstPostMetric(m.id, ["views", "impressions", "reach"], pageToken),
      firstPostMetric(m.id, ["saved"], pageToken),
      firstPostMetric(m.id, ["shares"], pageToken),
    ]);
    return { views, saved, shares };
  });
  return posts.map((m, i) => ({
    id: m.id,
    network: "instagram",
    text: m.caption ?? "",
    type: IG_TYPES[m.media_product_type === "REELS" ? "REELS" : m.media_type] ?? "Publicación",
    publishedAt: m.timestamp,
    permalink: m.permalink ?? null,
    thumbnail: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : (m.media_url ?? null)),
    views: extra[i].views,
    interactions: (m.like_count ?? 0) + (m.comments_count ?? 0) + (extra[i].saved ?? 0) + (extra[i].shares ?? 0),
  }));
}

// ---- Ads ----

type AdAction = { action_type: string; value: string };
type AdInsightRow = {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  spend?: string;
  actions?: AdAction[];
  action_values?: AdAction[];
};

const MESSAGING_ACTION = "onsite_conversion.messaging_conversation_started_7d";
const PURCHASE_ACTIONS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

// The action Meta counts as a "result" for each campaign objective.
const RESULT_ACTIONS: Record<string, string[]> = {
  OUTCOME_LEADS: ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", MESSAGING_ACTION],
  OUTCOME_SALES: [...PURCHASE_ACTIONS, MESSAGING_ACTION],
  OUTCOME_TRAFFIC: ["landing_page_view", "link_click"],
  OUTCOME_ENGAGEMENT: [MESSAGING_ACTION, "post_engagement"],
  OUTCOME_AWARENESS: [],
  OUTCOME_APP_PROMOTION: ["mobile_app_install", "app_install"],
};

export function resultsFor(objective: string | undefined, actions: AdAction[] | undefined): number | null {
  const wanted = RESULT_ACTIONS[objective ?? ""];
  if (!wanted || wanted.length === 0) return null;
  for (const type of wanted) {
    const hit = actions?.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

function firstAction(list: AdAction[] | undefined, types: string[]): number {
  for (const type of types) {
    const hit = list?.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Clientes potenciales",
  OUTCOME_SALES: "Ventas",
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_AWARENESS: "Reconocimiento",
  OUTCOME_APP_PROMOTION: "Promoción de app",
};
export const objectiveLabel = (o: string | undefined) => (o ? (OBJECTIVE_LABELS[o] ?? o.replace(/^OUTCOME_/, "").toLowerCase()) : "—");

export type AdTotals = {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  /** Clicks that went to the ad's destination (WhatsApp, web…), not likes or "see more". */
  linkClicks?: number;
  /** WhatsApp/Messenger conversations the ads started. */
  conversations?: number;
  purchases?: number;
  purchaseValue?: number;
};
export type AdCampaign = AdTotals & {
  id: string;
  name: string;
  objective: string;
  results: number | null;
  updatedAt: string | null;
  /** ACTIVE, PAUSED, ARCHIVED… as Meta reports it. */
  status?: string | null;
};
export type AdsData = { currency: string; daily: Record<string, AdTotals>; totals: AdTotals; campaigns: AdCampaign[] };

const num = (v: string | undefined) => Number(v ?? 0) || 0;
const totalsOf = (r: AdInsightRow): AdTotals => ({
  impressions: num(r.impressions),
  reach: num(r.reach),
  clicks: num(r.clicks),
  spend: num(r.spend),
  linkClicks: num(r.inline_link_clicks),
  conversations: firstAction(r.actions, [MESSAGING_ACTION]),
  purchases: firstAction(r.actions, PURCHASE_ACTIONS),
  purchaseValue: firstAction(r.action_values, PURCHASE_ACTIONS),
});

const TOTAL_FIELDS = "impressions,reach,clicks,inline_link_clicks,spend,actions,action_values";
const EMPTY_TOTALS: AdTotals = { impressions: 0, reach: 0, clicks: 0, spend: 0, linkClicks: 0, conversations: 0, purchases: 0, purchaseValue: 0 };

export async function metaAds(adAccountId: string, userToken: string, range: DayRange, currency: string): Promise<AdsData> {
  const timeRange = JSON.stringify({ since: range.since, until: range.until });
  const [daily, totals, campaigns, campaignMeta] = await Promise.all([
    graphAll<AdInsightRow>(`${adAccountId}/insights`, { fields: "impressions,reach,clicks,spend", time_range: timeRange, time_increment: "1", limit: "100" }, userToken),
    // Reach can't be summed across days (the same person counts once), so the totals come from Meta.
    metaAdTotals(adAccountId, userToken, range),
    graphAll<AdInsightRow>(
      `${adAccountId}/insights`,
      { level: "campaign", fields: `campaign_id,campaign_name,objective,${TOTAL_FIELDS}`, time_range: timeRange, limit: "100" },
      userToken,
    ),
    graphAll<{ id: string; updated_time?: string; effective_status?: string }>(
      `${adAccountId}/campaigns`,
      { fields: "id,updated_time,effective_status", limit: "200" },
      userToken,
      2,
    ).catch(() => []),
  ]);
  const meta = new Map(campaignMeta.map((c) => [c.id, c]));
  const dailyMap: Record<string, AdTotals> = {};
  for (const row of daily) if (row.date_start) dailyMap[row.date_start] = totalsOf(row);
  return {
    currency,
    daily: dailyMap,
    totals,
    campaigns: campaigns.map((c) => ({
      id: c.campaign_id ?? c.campaign_name ?? "",
      name: c.campaign_name ?? "Campaña",
      objective: c.objective ?? "",
      results: resultsFor(c.objective, c.actions),
      updatedAt: c.campaign_id ? (meta.get(c.campaign_id)?.updated_time ?? null) : null,
      status: c.campaign_id ? (meta.get(c.campaign_id)?.effective_status ?? null) : null,
      ...totalsOf(c),
    })),
  };
}

/** Account totals for a range (also used for the previous-period comparison). */
export async function metaAdTotals(adAccountId: string, userToken: string, range: DayRange): Promise<AdTotals> {
  const rows = await graph<{ data: AdInsightRow[] }>(
    `${adAccountId}/insights`,
    { fields: TOTAL_FIELDS, time_range: JSON.stringify({ since: range.since, until: range.until }) },
    userToken,
  );
  return rows.data[0] ? totalsOf(rows.data[0]) : { ...EMPTY_TOTALS };
}

export const cpm = (t: AdTotals) => (t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null);
export const cpc = (t: AdTotals) => (t.clicks > 0 ? t.spend / t.clicks : null);
export const ctr = (t: AdTotals) => (t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null);
/** Clicks to the destination per 100 impressions: the click rate that matters for selling. */
export const linkCtr = (t: AdTotals) => (t.impressions > 0 && t.linkClicks != null ? (t.linkClicks / t.impressions) * 100 : null);
/** How many times, on average, each person saw the ads. */
export const frequency = (t: AdTotals) => (t.reach > 0 ? t.impressions / t.reach : null);
export const costPerConversation = (t: AdTotals) => (t.conversations ? t.spend / t.conversations : null);
/** Revenue per unit spent, from purchases Meta tracked (pixel or catalog). */
export const roas = (t: AdTotals) => (t.purchaseValue && t.spend > 0 ? t.purchaseValue / t.spend : null);
