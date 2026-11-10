import { afterEach, describe, expect, it, vi } from "vitest";
import { adAudience, adCreatives, ageLabel, groupSegments, placementLabel, rankingLevel, videoStatsOf } from "./adCreatives";
import { parseDemographics } from "./metaSocial";

type Handler = (url: URL) => { status?: number; body: unknown };
function mockGraph(handler: Handler) {
  const fetchMock = vi.fn(async (input: URL | string) => {
    const { status = 200, body } = handler(new URL(String(input)));
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

const range = { since: "2026-10-01", until: "2026-10-30" };
const fieldsOf = (u: URL) => (u.searchParams.get("fields") ?? "").split(",");
const invalid = (field: string) => ({ status: 400, body: { error: { message: `(#100) ${field} is not a valid field`, code: 100 } } });

describe("videoStatsOf", () => {
  it("reads the 3-second plays from the actions and the rest from their own fields", () => {
    const v = videoStatsOf({ actions: [{ action_type: "video_view", value: "300" }], video_p50_watched_actions: [{ action_type: "video_view", value: "90" }], video_thruplay_watched_actions: [{ action_type: "video_view", value: "120" }] });
    expect(v).toMatchObject({ views3s: 300, p50: 90, thruplays: 120, p25: null });
  });
  it("is null for an image ad", () => {
    expect(videoStatsOf({ actions: [{ action_type: "link_click", value: "5" }] })).toBeNull();
  });
});

describe("rankings and labels", () => {
  it("maps Meta's quality levels", () => {
    expect(rankingLevel("ABOVE_AVERAGE")).toBe("above");
    expect(rankingLevel("BELOW_AVERAGE_20")).toBe("below");
    expect(rankingLevel("UNKNOWN")).toBeNull();
    expect(rankingLevel(undefined)).toBeNull();
  });
  it("names ages and placements in Spanish", () => {
    expect(ageLabel("25-34")).toBe("25 a 34 años");
    expect(ageLabel("65+")).toBe("65 años o más");
    expect(placementLabel("instagram", "instagram_reels")).toBe("Instagram · Reels");
    expect(placementLabel("facebook", "feed")).toBe("Facebook · Feed");
    expect(placementLabel("messenger", undefined)).toBe("Messenger");
  });
  it("adds up the rows of a group", () => {
    const g = groupSegments(
      [
        { age: "25-34", gender: "female", impressions: "100", spend: "10", inline_link_clicks: "4", actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" }] },
        { age: "25-34", gender: "male", impressions: "50", spend: "5", inline_link_clicks: "1" },
      ],
      (r) => ({ key: r.age ?? "", label: ageLabel(r.age ?? "") }),
    );
    expect(g).toEqual([{ key: "25-34", label: "25 a 34 años", impressions: 150, spend: 15, linkClicks: 5, conversations: 2 }]);
  });
});

describe("parseDemographics", () => {
  it("reads Meta's breakdown results, largest first", () => {
    const body = { data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: ["25-34"], value: 10 }, { dimension_values: ["18-24"], value: 30 }, { dimension_values: ["65+"], value: 0 }] }] } }] };
    expect(parseDemographics(body)).toEqual([
      { label: "18-24", value: 30 },
      { label: "25-34", value: 10 },
    ]);
    expect(parseDemographics({})).toEqual([]);
  });
});

describe("adCreatives", () => {
  const core = {
    data: [
      { ad_id: "1", ad_name: "Reel promo", campaign_name: "Camp", objective: "OUTCOME_ENGAGEMENT", impressions: "10000", reach: "5000", inline_link_clicks: "150", spend: "100", frequency: "2", actions: [{ action_type: "video_view", value: "3500" }, { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "10" }] },
      { ad_id: "2", ad_name: "Foto", campaign_name: "Camp", impressions: "5000", reach: "4000", inline_link_clicks: "40", spend: "40" },
      { ad_id: "3", ad_name: "Sin gasto", impressions: "10", spend: "0" },
    ],
  };

  it("builds each ad with its video numbers, thumbnail and ranking, biggest spender first", async () => {
    mockGraph((u) => {
      if (u.searchParams.has("ids")) return { body: { "1": { effective_status: "ACTIVE", creative: { thumbnail_url: "t1", object_type: "VIDEO", video_id: "v" } }, "2": { effective_status: "PAUSED", creative: { image_url: "img2", thumbnail_url: "t2" } } } };
      const f = fieldsOf(u);
      if (f.includes("video_p25_watched_actions")) return { body: { data: [{ ad_id: "1", video_p50_watched_actions: [{ action_type: "video_view", value: "1400" }], video_thruplay_watched_actions: [{ action_type: "video_view", value: "1200" }] }] } };
      if (f.includes("quality_ranking")) return { body: { data: [{ ad_id: "1", quality_ranking: "ABOVE_AVERAGE", engagement_rate_ranking: "AVERAGE", conversion_rate_ranking: "UNKNOWN" }] } };
      return { body: core };
    });
    const list = await adCreatives("act_1", "tok", range);
    expect(list.map((a) => a.name)).toEqual(["Reel promo", "Foto"]);
    const [reel, foto] = list;
    expect(reel).toMatchObject({ isVideo: true, status: "ACTIVE", thumbnail: "t1", rankings: { quality: "above", engagement: "average", conversion: null } });
    expect(reel.numbers.video).toMatchObject({ views3s: 3500, p50: 1400, thruplays: 1200 });
    expect(reel.numbers.conversations).toBe(10);
    expect(foto).toMatchObject({ isVideo: false, thumbnail: "img2", rankings: null });
    expect(foto.numbers.video).toBeNull();
  });

  it("keeps the fields Meta still accepts when it refuses one of the group", async () => {
    const fetchMock = mockGraph((u) => {
      if (u.searchParams.has("ids")) return { body: {} };
      const f = fieldsOf(u);
      if (f.includes("video_p25_watched_actions")) return invalid("video_p25_watched_actions");
      if (f.includes("video_p50_watched_actions")) return { body: { data: [{ ad_id: "1", video_p50_watched_actions: [{ action_type: "video_view", value: "1400" }] }] } };
      if (f.includes("quality_ranking")) return invalid("quality_ranking");
      if (f.some((x) => x.endsWith("_ranking"))) return invalid("ranking");
      if (f.some((x) => x.startsWith("video_"))) return { body: { data: [] } };
      return { body: core };
    });
    const list = await adCreatives("act_1", "tok", range);
    expect(list[0].numbers.video?.p50).toBe(1400);
    expect(list[0].numbers.video?.p25).toBeNull();
    expect(list[0].rankings).toBeNull();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
  });

  it("doesn't fan out into one request per field when Meta is rate limiting", async () => {
    mockGraph((u) => {
      const f = fieldsOf(u);
      if (f.includes("video_p25_watched_actions") || f.includes("quality_ranking")) return { status: 400, body: { error: { message: "limit", code: 17 } } };
      if (u.searchParams.has("ids")) return { body: {} };
      return { body: core };
    });
    await expect(adCreatives("act_1", "tok", range)).rejects.toMatchObject({ code: 17 });
  });

  it("works without thumbnails when that request fails", async () => {
    mockGraph((u) => (u.searchParams.has("ids") ? invalid("creative") : { body: u.searchParams.get("fields")?.includes("ad_name") ? core : { data: [] } }));
    const list = await adCreatives("act_1", "tok", range);
    expect(list).toHaveLength(2);
    expect(list[0].thumbnail).toBeNull();
  });
});

describe("adAudience", () => {
  it("groups age and gender", async () => {
    mockGraph(() => ({
      body: {
        data: [
          { age: "25-34", gender: "female", impressions: "100", spend: "10", inline_link_clicks: "4" },
          { age: "18-24", gender: "female", impressions: "100", spend: "10", inline_link_clicks: "4" },
          { age: "25-34", gender: "male", impressions: "50", spend: "5", inline_link_clicks: "1" },
        ],
      },
    }));
    const a = await adAudience("act_1", "tok", range);
    expect(a.age.map((x) => x.label)).toEqual(["18 a 24 años", "25 a 34 años"]);
    expect(a.gender.find((g) => g.label === "Mujeres")?.spend).toBe(20);
  });
});
