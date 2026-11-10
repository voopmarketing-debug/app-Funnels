import { describe, expect, it } from "vitest";
import type { SocialPost } from "./metaSocial";
import {
  accountCreativeKpis,
  adviseCreative,
  creativeHighlights,
  creativeScore,
  formatPerformance,
  hookRate,
  holdRate,
  organicHighlights,
  readOrganicVideos,
  readSegments,
  retentionSteps,
  scoreContext,
  segmentTips,
  type CreativeNumbers,
  type Segment,
} from "./contentKpis";

const video = (over: Partial<CreativeNumbers> = {}, v: Partial<NonNullable<CreativeNumbers["video"]>> = {}): CreativeNumbers => ({
  impressions: 10_000,
  reach: 5_000,
  spend: 100,
  linkClicks: 150,
  conversations: 10,
  frequency: 1.8,
  video: { views3s: 3_500, thruplays: 1_200, p25: 2_000, p50: 1_400, p75: 1_000, p100: 800, avgWatchSeconds: 9, ...v },
  ...over,
});
const image = (over: Partial<CreativeNumbers> = {}): CreativeNumbers => ({ impressions: 8_000, reach: 4_000, spend: 80, linkClicks: 100, conversations: 8, frequency: 1.5, video: null, ...over });
const ctx = { avgCostPerConversation: 10, accountHasConversations: true };

describe("hook, hold and retention", () => {
  it("hook is the share of impressions that stayed 3 seconds", () => {
    expect(hookRate(video())).toBeCloseTo(35);
    expect(hookRate(image())).toBeNull();
  });
  it("hold is ThruPlays over 3-second views, and unknown with too few views", () => {
    expect(holdRate(video())).toBeCloseTo((1200 / 3500) * 100);
    expect(holdRate(video({}, { views3s: 40 }))).toBeNull();
  });
  it("retention counts from the people who stayed 3 seconds and never passes 100", () => {
    const steps = retentionSteps(video().video);
    expect(steps.map((s) => s.label)).toEqual(["25%", "50%", "75%", "100%"]);
    expect(steps[1].pct).toBeCloseTo(40);
    expect(retentionSteps(video({}, { p25: 9_999 }).video)[0].pct).toBe(100);
    expect(retentionSteps(null)).toEqual([]);
  });
});

describe("adviseCreative", () => {
  it("asks for more time when there are too few impressions", () => {
    const a = adviseCreative(video({ impressions: 400 }), ctx);
    expect(a.verdict).toBe("poco_dato");
    expect(a.score).toBeNull();
  });

  it("scales an ad where everything works", () => {
    const a = adviseCreative(video({ conversations: 14 }), ctx);
    expect(a.verdict).toBe("escalar");
    expect(a.score).toBeGreaterThanOrEqual(75);
    expect(a.actions.some((x) => x.text.includes("20%"))).toBe(true);
  });

  it("points at the hook first when people don't stop", () => {
    const a = adviseCreative(video({}, { views3s: 1_200, thruplays: 500 }), ctx);
    expect(a.bottleneck).toBe("hook");
    expect(a.actions[0].text).toContain("primeros 3 segundos");
  });

  it("points at the hold when they stop but leave", () => {
    const a = adviseCreative(video({}, { thruplays: 200 }), ctx);
    expect(a.bottleneck).toBe("hold");
    expect(a.actions[0].text).toContain("se van");
  });

  it("points at the call to action when they watch but don't click", () => {
    const a = adviseCreative(video({ linkClicks: 20 }), ctx);
    expect(a.bottleneck).toBe("ctr");
  });

  it("blames what happens after the click when clicks bring no conversation", () => {
    const a = adviseCreative(video({ conversations: 0, linkClicks: 200 }), ctx);
    expect(a.bottleneck).toBe("cost");
    expect(a.actions[0].text).toContain("200 clics");
  });

  it("judges an image ad without hook or hold, and not at all from a single number", () => {
    const a = adviseCreative(image(), ctx);
    expect(a.factors.map((f) => f.key)).not.toContain("hook");
    expect(a.score).not.toBeNull();
    expect(creativeScore([{ key: "ctr", label: "x", level: "good", weight: 20, value: 2 }])).toBeNull();
  });

  it("warns of fatigue", () => {
    const a = adviseCreative(video({ frequency: 4.2 }), ctx);
    expect(a.actions.some((x) => x.text.includes("se está cansando"))).toBe(true);
  });

  it("replaces an ad with a very low score", () => {
    const a = adviseCreative(video({ conversations: 0, linkClicks: 40, frequency: 4 }, { views3s: 900, thruplays: 30 }), ctx);
    expect(a.verdict).toBe("reemplazar");
  });

  it("leaves awareness ads out of the click-rate judgement", () => {
    const a = adviseCreative(image({ objective: "OUTCOME_AWARENESS", linkClicks: 1, conversations: 0 }), { avgCostPerConversation: null, accountHasConversations: false });
    expect(a.factors.map((f) => f.key)).not.toContain("ctr");
  });
});

describe("account level", () => {
  const rows = [video(), video({ impressions: 5_000 }, { views3s: 500, thruplays: 100 }), image()];
  it("weights hook by impressions", () => {
    const k = accountCreativeKpis(rows);
    expect(k.videos).toBe(2);
    expect(k.hook).toBeCloseTo(((3500 + 500) / 15000) * 100);
  });
  it("derives the account's cost per conversation from its ads", () => {
    expect(scoreContext([video(), image()])).toEqual({ avgCostPerConversation: 180 / 18, accountHasConversations: true });
    expect(scoreContext([image({ conversations: 0 })]).accountHasConversations).toBe(false);
  });
  it("says what to do first", () => {
    const c = scoreContext(rows);
    const entries = [
      { name: "Bueno", numbers: video({ conversations: 14 }), advice: adviseCreative(video({ conversations: 14 }), c) },
      { name: "Aburrido", numbers: video({ spend: 300, conversations: 0, linkClicks: 40, frequency: 4 }, { views3s: 900, thruplays: 30 }), advice: adviseCreative(video({ spend: 300, conversations: 0, linkClicks: 40, frequency: 4 }, { views3s: 900, thruplays: 30 }), c) },
    ];
    const text = creativeHighlights(entries, (n) => `$${n}`).map((h) => h.text).join(" | ");
    expect(text).toContain("«Bueno» es tu mejor anuncio");
    expect(text).toContain("«Aburrido» ya gastó $300");
  });
});

describe("segments", () => {
  const seg = (label: string, spend: number, conversations: number, linkClicks = 0): Segment => ({ key: label, label, impressions: 1_000, spend, linkClicks, conversations });
  it("favours the cheapest group and drops the one that spends without results", () => {
    const r = readSegments([seg("Mujeres 25 a 34", 100, 10), seg("Hombres 45 a 54", 100, 0), seg("Mujeres 35 a 44", 100, 4)]);
    expect(r.best?.label).toBe("Mujeres 25 a 34");
    expect(r.worst?.label).toBe("Hombres 45 a 54");
    const tips = segmentTips(r, (n) => `$${n}`, "El grupo").map((t) => t.text);
    expect(tips[0]).toContain("Cada conversación te cuesta $10");
    expect(tips[1]).toContain("Hombres 45 a 54: se llevó");
    expect(tips[1]).toContain("no trajo ninguna conversación");
  });
  it("makes no comparison with too few conversations or clicks", () => {
    const r = readSegments([seg("A", 50, 1), seg("B", 50, 2, 5)]);
    expect(r.unit).toBeNull();
    expect(r.best).toBeNull();
  });
});

const post = (over: Partial<SocialPost>): SocialPost => ({ id: "p", network: "instagram", text: "", type: "Reel", publishedAt: "2026-10-05T15:00:00Z", permalink: null, thumbnail: null, views: 1_000, interactions: 50, ...over });

describe("organic content", () => {
  const posts = [
    post({ id: "1", watchSeconds: 12, reach: 800, shares: 20, saves: 30 }),
    post({ id: "2", watchSeconds: 4, reach: 900, shares: 2, saves: 3 }),
    post({ id: "3", watchSeconds: 7, reach: 700, shares: 3, saves: 2 }),
    post({ id: "4", type: "Foto", views: 1_000, interactions: 10 }),
    post({ id: "5", type: "Foto", views: 1_000, interactions: 12 }),
  ];
  it("compares each video's watch time with the account's median", () => {
    const { rows, medianWatch } = readOrganicVideos(posts);
    expect(medianWatch).toBe(7);
    expect(rows[0].post.id).toBe("1");
    expect(rows[0].versus).toBe("above");
    expect(rows[0].tips.map((t) => t.text).join(" ")).toContain("comparten");
    expect(rows[2].versus).toBe("below");
  });
  it("ranks formats by reaction per view", () => {
    expect(formatPerformance(posts)[0].type).toBe("Reel");
  });
  it("recommends the format that works", () => {
    expect(organicHighlights(posts).map((h) => h.text).join(" ")).toContain("reels generan");
  });
  it("admits when there is too little to say", () => {
    expect(organicHighlights([post({})]).some((h) => h.tone === "warn")).toBe(true);
  });
});
