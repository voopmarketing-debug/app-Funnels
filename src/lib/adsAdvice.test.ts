import { describe, expect, it } from "vitest";
import { adviseCampaign } from "./adsAdvice";
import type { AdCampaign, AdTotals } from "./metaSocial";

const campaign = (over: Partial<AdCampaign>): AdCampaign => ({
  id: "c",
  name: "Campaña",
  objective: "OUTCOME_ENGAGEMENT",
  results: 10,
  updatedAt: null,
  impressions: 10_000,
  reach: 5000,
  clicks: 150,
  linkClicks: 100,
  spend: 100,
  ...over,
});

const account = (all: AdCampaign[]): AdTotals =>
  all.reduce((a, c) => ({ impressions: a.impressions + c.impressions, reach: a.reach + c.reach, clicks: a.clicks + c.clicks, spend: a.spend + c.spend }), {
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend: 0,
  });

describe("adviseCampaign", () => {
  it("waits when there are too few impressions", () => {
    const c = campaign({ impressions: 400 });
    expect(adviseCampaign(c, [c], account([c])).verdict).toBe("poco_dato");
  });

  it("says to scale the cheapest campaign and pause the one spending without results", () => {
    const cheap = campaign({ id: "a", spend: 100, results: 40 });
    const pricey = campaign({ id: "b", spend: 100, results: 8 });
    const dead = campaign({ id: "c", spend: 100, results: 0, linkClicks: 30 });
    const all = [cheap, pricey, dead];
    expect(adviseCampaign(cheap, all, account(all)).verdict).toBe("escalar");
    expect(adviseCampaign(pricey, all, account(all)).verdict).toBe("optimizar");
    const deadAdvice = adviseCampaign(dead, all, account(all));
    expect(deadAdvice.verdict).toBe("pausar");
    expect(deadAdvice.tips.some((t) => t.tone === "bad")).toBe(true);
  });

  it("flags ad fatigue from frequency", () => {
    const tired = campaign({ reach: 2000 }); // 10.000 / 2.000 = 5 views per person
    const advice = adviseCampaign(tired, [tired], account([tired]));
    expect(advice.tips.some((t) => /cansando/.test(t.text))).toBe(true);
  });
});
