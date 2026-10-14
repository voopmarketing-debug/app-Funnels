import { describe, expect, it } from "vitest";
import { adsHighlights, adviseCampaign, campaignOutcome } from "./adsAdvice";
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

describe("campaignOutcome", () => {
  it("counts WhatsApp conversations first, whatever the objective", () => {
    const o = campaignOutcome(campaign({ objective: "OUTCOME_LEADS", conversations: 4, spend: 200 }));
    expect(o).toMatchObject({ count: 4, plural: "conversaciones", cost: 50, goal: "conseguir clientes potenciales" });
  });

  it("speaks of link clicks for old traffic campaigns", () => {
    const o = campaignOutcome(campaign({ objective: "LINK_CLICKS", results: null, linkClicks: 40, spend: 80 }));
    expect(o).toMatchObject({ count: 40, plural: "clics a tu enlace", cost: 2 });
  });

  it("prices awareness per 1.000 people reached", () => {
    const o = campaignOutcome(campaign({ objective: "OUTCOME_AWARENESS", reach: 20_000, spend: 100 }));
    expect(o).toMatchObject({ count: 20_000, cost: 5, costLabel: "Llegar a 1.000 personas te costó" });
  });
});

describe("adsHighlights", () => {
  const money = (n: number) => `$${Math.round(n)}`;

  it("names the campaign that spends without results and the cheapest one", () => {
    const waste = campaign({ id: "w", name: "Sin resultados", results: 0, spend: 300, status: "ACTIVE" });
    const good = campaign({ id: "g", name: "La buena", results: 30, conversations: 30, spend: 90, linkClicks: 300, status: "ACTIVE" });
    const ok = campaign({ id: "o", name: "Normal", results: 10, spend: 100 });
    const all = [waste, good, ok];
    const h = adsHighlights(all, account(all), money);
    expect(h[0]).toMatchObject({ tone: "bad" });
    expect(h[0].text).toContain("«Sin resultados»");
    expect(h[0].text).toContain("sin conseguir");
    expect(h.find((x) => x.tone === "good")?.text).toContain("«La buena»");
  });

  it("says when nothing is running", () => {
    const all = [campaign({ status: "PAUSED" })];
    expect(adsHighlights(all, account(all), money).some((x) => x.text.includes("ninguna campaña encendida"))).toBe(true);
  });
});
