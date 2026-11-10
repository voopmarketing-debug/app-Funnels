import { MetaApiError, graph, graphAll, type DayRange } from "@/lib/metaSocial";
import type { CreativeNumbers, Segment, VideoStats } from "@/lib/contentKpis";

// Ads one by one (with their video numbers) and who they reach, from Meta's
// Marketing API. Meta retires and renames insight fields often, so everything
// beyond the basics is asked for in its own request and, when Meta refuses a
// field, that field is dropped instead of failing the page: a missing number
// is simply not shown.

const MAX_ADS = 30;
// The Graph API refuses to be asked about many more ads by id at once.
const IDS_PER_REQUEST = 25;
// Meta tells these apart from a wrong field: retrying them one by one would only make it worse.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

type Action = { action_type: string; value: string };
type AdRow = {
  ad_id?: string;
  ad_name?: string;
  campaign_name?: string;
  objective?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  spend?: string;
  frequency?: string;
  actions?: Action[];
  video_p25_watched_actions?: Action[];
  video_p50_watched_actions?: Action[];
  video_p75_watched_actions?: Action[];
  video_p100_watched_actions?: Action[];
  video_thruplay_watched_actions?: Action[];
  video_avg_time_watched_actions?: Action[];
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
};

const VIDEO_FIELDS = [
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "video_thruplay_watched_actions",
  "video_avg_time_watched_actions",
];
const RANKING_FIELDS = ["quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking"];

const MESSAGING_ACTION = "onsite_conversion.messaging_conversation_started_7d";
const PURCHASE_ACTIONS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

const num = (v: string | undefined) => Number(v ?? 0) || 0;

function actionValue(list: Action[] | undefined, types: string[]): number | null {
  if (!list?.length) return null;
  for (const type of types) {
    const hit = list.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return null;
}

/** Video actions come as `[{action_type: "video_view", value}]`: one value per ad. */
const videoValue = (list: Action[] | undefined) => (list?.length ? list.reduce((t, a) => t + (Number(a.value) || 0), 0) : null);

export function videoStatsOf(row: AdRow): VideoStats | null {
  const stats: VideoStats = {
    views3s: actionValue(row.actions, ["video_view"]),
    thruplays: videoValue(row.video_thruplay_watched_actions),
    p25: videoValue(row.video_p25_watched_actions),
    p50: videoValue(row.video_p50_watched_actions),
    p75: videoValue(row.video_p75_watched_actions),
    p100: videoValue(row.video_p100_watched_actions),
    avgWatchSeconds: videoValue(row.video_avg_time_watched_actions),
  };
  // An image ad has none of these.
  return Object.values(stats).some((v) => v != null) ? stats : null;
}

/**
 * Reads the requested fields in one request; when Meta refuses the group,
 * asks for each field alone and keeps the ones it accepts. Rows are merged by ad.
 */
async function optionalFields(path: string, params: Record<string, string>, fields: string[], token: string): Promise<Map<string, AdRow>> {
  const out = new Map<string, AdRow>();
  const read = async (list: string[]) => {
    const rows = await graphAll<AdRow>(path, { ...params, fields: ["ad_id", ...list].join(",") }, token, 3);
    for (const r of rows) if (r.ad_id) out.set(r.ad_id, { ...out.get(r.ad_id), ...r });
  };
  const fatal = (err: unknown) => err instanceof MetaApiError && (err.needsReconnect || (err.code != null && RATE_LIMIT_CODES.has(err.code)));
  try {
    await read(fields);
    return out;
  } catch (err) {
    if (fatal(err)) throw err;
  }
  for (const field of fields) {
    try {
      await read([field]);
    } catch (err) {
      if (fatal(err)) throw err;
    }
  }
  return out;
}

export type RankingLevel = "above" | "average" | "below";
export type AdRankings = { quality: RankingLevel | null; engagement: RankingLevel | null; conversion: RankingLevel | null };

/** Meta's own read of an ad against others competing for the same people. */
export function rankingLevel(value: string | undefined): RankingLevel | null {
  if (!value) return null;
  if (value === "ABOVE_AVERAGE") return "above";
  if (value === "AVERAGE") return "average";
  if (value.startsWith("BELOW_AVERAGE")) return "below";
  return null; // UNKNOWN: too few impressions
}

export type AdCreative = {
  id: string;
  name: string;
  campaignName: string;
  status: string | null;
  thumbnail: string | null;
  isVideo: boolean;
  numbers: CreativeNumbers;
  /** Missing when Meta no longer reports them for this account. */
  rankings: AdRankings | null;
};

type CreativeLook = { effective_status?: string; creative?: { thumbnail_url?: string; image_url?: string; object_type?: string; video_id?: string } };

/** Thumbnail and state of each ad, asked by id in groups. A failure leaves the cards without picture. */
async function looksOf(ids: string[], token: string): Promise<Map<string, CreativeLook>> {
  const out = new Map<string, CreativeLook>();
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + IDS_PER_REQUEST);
    try {
      const res = await graph<Record<string, CreativeLook>>("", { ids: chunk.join(","), fields: "effective_status,creative{thumbnail_url,image_url,object_type,video_id}" }, token);
      for (const id of chunk) if (res[id]) out.set(id, res[id]);
    } catch (err) {
      if (err instanceof MetaApiError && err.needsReconnect) throw err;
    }
  }
  return out;
}

/** The ads that spent in the range, biggest spender first, with their video funnel and quality. */
export async function adCreatives(adAccountId: string, userToken: string, range: DayRange): Promise<AdCreative[]> {
  const params = { level: "ad", time_range: JSON.stringify({ since: range.since, until: range.until }), limit: "100" };
  const path = `${adAccountId}/insights`;
  const [core, video, rankings] = await Promise.all([
    graphAll<AdRow>(path, { ...params, fields: "ad_id,ad_name,campaign_name,objective,impressions,reach,inline_link_clicks,spend,frequency,actions" }, userToken, 3),
    optionalFields(path, params, VIDEO_FIELDS, userToken),
    optionalFields(path, params, RANKING_FIELDS, userToken),
  ]);
  const top = core
    .filter((r) => r.ad_id && num(r.spend) > 0)
    .sort((a, b) => num(b.spend) - num(a.spend))
    .slice(0, MAX_ADS);
  const looks = await looksOf(
    top.map((r) => r.ad_id as string),
    userToken,
  );

  return top.map((r) => {
    const id = r.ad_id as string;
    const merged: AdRow = { ...r, ...video.get(id) };
    const stats = videoStatsOf(merged);
    const look = looks.get(id);
    const rank = rankings.get(id);
    const ranks: AdRankings = { quality: rankingLevel(rank?.quality_ranking), engagement: rankingLevel(rank?.engagement_rate_ranking), conversion: rankingLevel(rank?.conversion_rate_ranking) };
    const reach = num(r.reach);
    const impressions = num(r.impressions);
    return {
      id,
      name: r.ad_name ?? "Anuncio",
      campaignName: r.campaign_name ?? "",
      status: look?.effective_status ?? null,
      // Photo ads have the full image; video ads only a small still.
      thumbnail: (look?.creative?.object_type === "VIDEO" ? null : look?.creative?.image_url) ?? look?.creative?.thumbnail_url ?? null,
      isVideo: stats != null || look?.creative?.object_type === "VIDEO" || Boolean(look?.creative?.video_id),
      rankings: Object.values(ranks).some(Boolean) ? ranks : null,
      numbers: {
        objective: r.objective,
        impressions,
        reach,
        spend: num(r.spend),
        linkClicks: num(r.inline_link_clicks),
        conversations: actionValue(r.actions, [MESSAGING_ACTION]) ?? 0,
        purchases: actionValue(r.actions, PURCHASE_ACTIONS) ?? 0,
        frequency: r.frequency != null ? num(r.frequency) || null : reach > 0 ? impressions / reach : null,
        video: stats,
      },
    };
  });
}

// ---- Who sees the ads ----

type BreakdownRow = { age?: string; gender?: string; publisher_platform?: string; platform_position?: string; impressions?: string; spend?: string; inline_link_clicks?: string; actions?: Action[] };

const GENDERS: Record<string, string> = { female: "Mujeres", male: "Hombres", unknown: "Sin definir" };

export const ageLabel = (age: string): string => (age === "65+" ? "65 años o más" : /^\d+-\d+$/.test(age) ? `${age.replace("-", " a ")} años` : "Sin definir");

const PLATFORMS: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", audience_network: "Red de audiencia", messenger: "Messenger", whatsapp: "WhatsApp" };
const POSITIONS: Record<string, string> = {
  feed: "Feed",
  story: "Historias",
  facebook_stories: "Historias",
  instagram_stories: "Historias",
  reels: "Reels",
  facebook_reels: "Reels",
  instagram_reels: "Reels",
  facebook_reels_overlay: "Reels",
  instream_video: "Videos",
  video_feeds: "Videos",
  marketplace: "Marketplace",
  search: "Búsqueda",
  instagram_search: "Búsqueda",
  explore: "Explorar",
  explore_home: "Explorar",
  profile_feed: "Perfil",
  right_hand_column: "Columna derecha",
  an_classic: "Red de audiencia",
  messenger_inbox: "Bandeja de Messenger",
  messenger_stories: "Historias",
  instagram_profile_feed: "Perfil",
  instagram_standard: "Feed",
};

export function placementLabel(platform: string | undefined, position: string | undefined): string {
  const p = PLATFORMS[platform ?? ""] ?? (platform ? platform.replace(/_/g, " ") : "Otro");
  const where = POSITIONS[position ?? ""];
  return where && where !== p ? `${p} · ${where}` : p;
}

const segmentNumbers = (r: BreakdownRow) => ({
  impressions: num(r.impressions),
  spend: num(r.spend),
  linkClicks: num(r.inline_link_clicks),
  conversations: actionValue(r.actions, [MESSAGING_ACTION]) ?? 0,
});

/** Adds up the rows that share a label (the same age across both genders, the same placement across rows). */
export function groupSegments(rows: BreakdownRow[], keyOf: (r: BreakdownRow) => { key: string; label: string }): Segment[] {
  const groups = new Map<string, Segment>();
  for (const r of rows) {
    const { key, label } = keyOf(r);
    const n = segmentNumbers(r);
    const g = groups.get(key) ?? { key, label, impressions: 0, spend: 0, linkClicks: 0, conversations: 0 };
    groups.set(key, { ...g, impressions: g.impressions + n.impressions, spend: g.spend + n.spend, linkClicks: g.linkClicks + n.linkClicks, conversations: g.conversations + n.conversations });
  }
  return [...groups.values()];
}

const BREAKDOWN_FIELDS = "impressions,spend,inline_link_clicks,actions";

async function breakdown(adAccountId: string, token: string, range: DayRange, breakdowns: string): Promise<BreakdownRow[]> {
  return graphAll<BreakdownRow>(`${adAccountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns, time_range: JSON.stringify({ since: range.since, until: range.until }), limit: "500" }, token, 3);
}

/** Age and gender of the people the ads reached, with what each group cost and brought. */
export async function adAudience(adAccountId: string, userToken: string, range: DayRange): Promise<{ age: Segment[]; gender: Segment[] }> {
  const rows = await breakdown(adAccountId, userToken, range, "age,gender");
  return {
    age: groupSegments(rows, (r) => ({ key: r.age ?? "unknown", label: ageLabel(r.age ?? "") })).sort((a, b) => a.key.localeCompare(b.key, "es", { numeric: true })),
    gender: groupSegments(rows, (r) => ({ key: r.gender ?? "unknown", label: GENDERS[r.gender ?? ""] ?? "Sin definir" })),
  };
}

/** Where the ads were shown (Instagram Reels, Facebook Feed…) and how each place did. */
export async function adPlacements(adAccountId: string, userToken: string, range: DayRange): Promise<Segment[]> {
  const rows = await breakdown(adAccountId, userToken, range, "publisher_platform,platform_position");
  return groupSegments(rows, (r) => {
    const label = placementLabel(r.publisher_platform, r.platform_position);
    return { key: label, label };
  });
}
