import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import {
  MetaApiError,
  addDays,
  daysIn,
  facebookAccount,
  facebookPosts,
  instagramAccount,
  instagramPosts,
  instagramTotals,
  metaAdTotals,
  metaAds,
  previousRange,
  sum,
  type AdTotals,
  type AdsData,
  type DayRange,
  type NetworkAccount,
  type Series,
  type SocialPost,
} from "@/lib/metaSocial";

// Everything the "Redes sociales" page shows, read from Meta once and kept
// in SocialMetricCache for a few hours: a page with posts and ads makes
// dozens of Graph calls, too many to repeat on every visit.


const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
/** "Actualizar" is ignored while the data is younger than this. */
export const MIN_REFRESH_MS = 2 * 60 * 1000;

export type NetworkSummary = {
  followers: number | null;
  followersSeries: Series;
  /** Change in followers over the range, when the series covers it. */
  followersDelta: number | null;
  views: number | null;
  viewsPrev: number | null;
  viewsSeries: Series | null;
  engagement: number | null;
  engagementPrev: number | null;
};

export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type SocialDashboard = {
  range: DayRange;
  previous: DayRange;
  fetchedAt: string;
  facebook: SectionResult<NetworkSummary> | null;
  instagram: SectionResult<NetworkSummary> | null;
  posts: SectionResult<SocialPost[]> | null;
  ads: SectionResult<AdsData & { previous: AdTotals }> | null;
  needsReconnect: boolean;
};

function within(series: Series | null, range: DayRange): Series | null {
  if (!series) return null;
  const out: Series = {};
  for (const day of daysIn(range)) if (day in series) out[day] = series[day];
  return out;
}

/** Sum over the range, or null when Meta returned no day of it. */
function sumIn(series: Series | null, range: DayRange): number | null {
  const part = within(series, range);
  return part && Object.keys(part).length > 0 ? sum(part) : null;
}

function followersDelta(series: Series, range: DayRange): number | null {
  const first = series[range.since] ?? series[addDays(range.since, 1)];
  const last = series[range.until] ?? series[addDays(range.until, -1)];
  return first != null && last != null ? last - first : null;
}

async function settle<T>(fn: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof MetaApiError && err.needsReconnect) throw err;
    console.error("[social] Meta request failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error consultando Meta" };
  }
}

/** Fills days Meta didn't return from the daily snapshots we keep ourselves. */
async function withSnapshots(businessId: string, network: "facebook" | "instagram", series: Series, range: DayRange): Promise<Series> {
  if (daysIn(range).every((d) => d in series)) return series;
  const rows = await prisma.socialFollowerSnapshot.findMany({
    where: { businessId, network, date: { gte: new Date(`${range.since}T00:00:00Z`), lte: new Date(`${range.until}T00:00:00Z`) } },
    select: { date: true, followers: true },
  });
  const out = { ...series };
  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    if (!(day in out)) out[day] = r.followers;
  }
  return out;
}

async function saveSnapshot(businessId: string, network: string, followers: number | null, day: string) {
  if (followers == null) return;
  const date = new Date(`${day}T00:00:00Z`);
  await prisma.socialFollowerSnapshot.upsert({
    where: { businessId_network_date: { businessId, network, date } },
    create: { businessId, network, date, followers },
    update: { followers },
  });
}

type Totals = { views: number | null; interactions: number | null };

async function summarize(
  businessId: string,
  network: "facebook" | "instagram",
  load: (r: DayRange) => Promise<NetworkAccount>,
  range: DayRange,
  previous: DayRange,
  /** For networks that only give range totals (Instagram). */
  totals?: (r: DayRange) => Promise<Totals>,
): Promise<NetworkSummary> {
  // One request over both periods; split afterwards.
  const [both, current, prior] = await Promise.all([
    load({ since: previous.since, until: range.until }),
    totals?.(range),
    totals?.(previous).catch(() => null),
  ]);
  await saveSnapshot(businessId, network, both.followers, addDays(range.until, 1));
  const followersSeries = await withSnapshots(businessId, network, within(both.followersSeries, range) ?? {}, range);
  return {
    followers: both.followers,
    followersSeries,
    followersDelta: followersDelta(followersSeries, range),
    views: current ? current.views : sumIn(both.views, range),
    viewsPrev: totals ? (prior?.views ?? null) : sumIn(both.views, previous),
    viewsSeries: within(both.views, range),
    engagement: current ? current.interactions : sumIn(both.engagement, range),
    engagementPrev: totals ? (prior?.interactions ?? null) : sumIn(both.engagement, previous),
  };
}

async function loadFromMeta(businessId: string, range: DayRange): Promise<SocialDashboard> {
  const connection = await prisma.socialConnection.findUnique({ where: { businessId } });
  const previous = previousRange(range);
  const empty: SocialDashboard = {
    range,
    previous,
    fetchedAt: new Date().toISOString(),
    facebook: null,
    instagram: null,
    posts: null,
    ads: null,
    needsReconnect: false,
  };
  if (!connection) return empty;

  const pageToken = connection.pageAccessToken ? decryptSecret(connection.pageAccessToken) : null;
  const userToken = connection.userAccessToken ? decryptSecret(connection.userAccessToken) : null;
  const { fbPageId, igUserId, adAccountId } = connection;

  try {
    const [facebook, instagram, posts, ads] = await Promise.all([
      fbPageId && pageToken ? settle(() => summarize(businessId, "facebook", (r) => facebookAccount(fbPageId, pageToken, r), range, previous)) : null,
      igUserId && pageToken
        ? settle(() =>
            summarize(
              businessId,
              "instagram",
              (r) => instagramAccount(igUserId, pageToken, r),
              range,
              previous,
              (r) => instagramTotals(igUserId, pageToken, r),
            ),
          )
        : null,
      pageToken && (fbPageId || igUserId)
        ? settle(async () => {
            const [fb, ig] = await Promise.all([
              fbPageId ? facebookPosts(fbPageId, pageToken, range) : [],
              igUserId ? instagramPosts(igUserId, pageToken, range) : [],
            ]);
            return [...fb, ...ig].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
          })
        : null,
      adAccountId && userToken
        ? settle(async () => {
            const [current, prev] = await Promise.all([
              metaAds(adAccountId, userToken, range, connection.adCurrency ?? "USD"),
              metaAdTotals(adAccountId, userToken, previous),
            ]);
            return { ...current, previous: prev };
          })
        : null,
    ]);
    return { ...empty, facebook, instagram, posts, ads };
  } catch (err) {
    if (err instanceof MetaApiError && err.needsReconnect) return { ...empty, needsReconnect: true };
    throw err;
  }
}

const cacheKey = (range: DayRange) => `dashboard:${range.since}:${range.until}`;

/** Everything the page shows for `range`, compared with the same number of days just before it. */
export async function getSocialDashboard(businessId: string, range: DayRange): Promise<SocialDashboard> {
  const key = cacheKey(range);
  const cached = await prisma.socialMetricCache.findUnique({ where: { businessId_key: { businessId, key } } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) return cached.data as unknown as SocialDashboard;
  const fresh = await loadFromMeta(businessId, range);
  // A section Meta failed on is retried on the next visit instead of being cached for hours.
  const failed = [fresh.facebook, fresh.instagram, fresh.posts, fresh.ads].some((r) => r && !r.ok);
  if (!fresh.needsReconnect && !failed) {
    await prisma.socialMetricCache.upsert({
      where: { businessId_key: { businessId, key } },
      create: { businessId, key, data: fresh as object, fetchedAt: new Date() },
      update: { data: fresh as object, fetchedAt: new Date() },
    });
    // Every custom range leaves a row; old ones are no longer served anyway.
    await prisma.socialMetricCache.deleteMany({ where: { businessId, fetchedAt: { lt: new Date(Date.now() - 2 * 86_400_000) } } });
  }
  return fresh;
}

/** Drops the cached dashboards so the next visit reads Meta again. Returns false when it's too soon. */
export async function clearSocialCache(businessId: string, force = false): Promise<boolean> {
  if (!force) {
    const newest = await prisma.socialMetricCache.findFirst({ where: { businessId }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
    if (newest && Date.now() - newest.fetchedAt.getTime() < MIN_REFRESH_MS) return false;
  }
  await prisma.socialMetricCache.deleteMany({ where: { businessId } });
  return true;
}
