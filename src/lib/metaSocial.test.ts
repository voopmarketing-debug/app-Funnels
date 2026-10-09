import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetaApiError,
  cpc,
  cpm,
  ctr,
  daysIn,
  facebookAccount,
  instagramAccount,
  lastDays,
  metaAds,
  previousRange,
  resultsFor,
  signState,
  verifyState,
} from "./metaSocial";

type Handler = (url: URL) => { status?: number; body: unknown };

function mockGraph(handler: Handler) {
  const fetchMock = vi.fn(async (input: URL | string) => {
    const { status = 200, body } = handler(new URL(String(input)));
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const metaError = (code: number, message = "nope") => ({ status: 400, body: { error: { message, code } } });

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret";
});
afterEach(() => vi.unstubAllGlobals());

describe("OAuth state", () => {
  it("round-trips and rejects tampering", () => {
    const state = signState({ businessId: "b1", userId: "u1" });
    expect(verifyState(state)).toEqual({ businessId: "b1", userId: "u1" });
    const [body, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ businessId: "b2", userId: "u1", exp: Date.now() + 60000 })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
    expect(verifyState(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(verifyState("garbage")).toBeNull();
  });

  it("expires", () => {
    vi.useFakeTimers();
    const state = signState({ businessId: "b1", userId: "u1" });
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(verifyState(state)).toBeNull();
    vi.useRealTimers();
  });
});

describe("date ranges", () => {
  it("covers the last complete days in Colombia time", () => {
    // 2026-10-09 03:00 UTC is still Oct 8 in Bogotá.
    const r = lastDays(7, new Date("2026-10-09T03:00:00Z"));
    expect(r).toEqual({ since: "2026-10-01", until: "2026-10-07" });
    expect(daysIn(r)).toHaveLength(7);
    expect(previousRange(r)).toEqual({ since: "2026-09-24", until: "2026-09-30" });
  });
});

describe("ad math", () => {
  it("computes CPM, CPC and CTR, null when undefined", () => {
    const t = { impressions: 2000, reach: 1500, clicks: 40, spend: 10 };
    expect(cpm(t)).toBe(5);
    expect(cpc(t)).toBe(0.25);
    expect(ctr(t)).toBe(2);
    const empty = { impressions: 0, reach: 0, clicks: 0, spend: 0 };
    expect([cpm(empty), cpc(empty), ctr(empty)]).toEqual([null, null, null]);
  });

  it("counts results by campaign objective", () => {
    const actions = [
      { action_type: "link_click", value: "50" },
      { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" },
    ];
    expect(resultsFor("OUTCOME_ENGAGEMENT", actions)).toBe(12);
    expect(resultsFor("OUTCOME_TRAFFIC", actions)).toBe(50);
    expect(resultsFor("OUTCOME_LEADS", [])).toBe(0);
    expect(resultsFor("OUTCOME_AWARENESS", actions)).toBeNull();
    expect(resultsFor(undefined, actions)).toBeNull();
  });
});

describe("facebookAccount", () => {
  const range = { since: "2026-10-01", until: "2026-10-03" };

  it("falls back to an older metric name and dates each value by the day it describes", async () => {
    mockGraph((url) => {
      if (url.pathname.endsWith("/page1")) return { body: { followers_count: 120 } };
      const metric = url.searchParams.get("metric");
      if (metric === "page_media_view") return metaError(100, "(#100) The value must be a valid insights metric");
      const values = [
        { value: 10, end_time: "2026-10-02T07:00:00+0000" },
        { value: 20, end_time: "2026-10-03T07:00:00+0000" },
        { value: 30, end_time: "2026-10-04T07:00:00+0000" },
      ];
      if (metric === "page_impressions" || metric === "page_post_engagements" || metric === "page_follows") return { body: { data: [{ name: metric, values }] } };
      return metaError(100);
    });
    const fb = await facebookAccount("page1", "tok", range);
    expect(fb.followers).toBe(120);
    expect(fb.views).toEqual({ "2026-10-01": 10, "2026-10-02": 20, "2026-10-03": 30 });
    expect(fb.viewsTotal).toBe(60);
    expect(fb.engagementTotal).toBe(60);
  });

  it("leaves a metric empty when Meta refuses every name", async () => {
    mockGraph((url) => (url.pathname.endsWith("/page1") ? { body: { fan_count: 5 } } : metaError(100)));
    const fb = await facebookAccount("page1", "tok", range);
    expect(fb.followers).toBe(5);
    expect(fb.views).toBeNull();
    expect(fb.engagementTotal).toBeNull();
  });

  it("throws a reconnect error for an expired token", async () => {
    mockGraph(() => metaError(190, "Error validating access token"));
    await expect(facebookAccount("page1", "tok", range)).rejects.toSatisfy((e: unknown) => e instanceof MetaApiError && e.needsReconnect);
  });
});

describe("instagramAccount", () => {
  it("rebuilds the follower total backwards from new followers per day", async () => {
    mockGraph((url) => {
      if (url.pathname.endsWith("/ig1")) return { body: { followers_count: 100 } };
      const metric = url.searchParams.get("metric");
      if (metric === "follower_count")
        return {
          body: {
            data: [
              {
                name: metric,
                values: [
                  { value: 2, end_time: "2026-10-02T07:00:00+0000" },
                  { value: 3, end_time: "2026-10-03T07:00:00+0000" },
                  { value: 5, end_time: "2026-10-04T07:00:00+0000" },
                ],
              },
            ],
          },
        };
      return { body: { data: [{ name: metric, values: [] }] } };
    });
    const ig = await instagramAccount("ig1", "tok", { since: "2026-10-01", until: "2026-10-03" });
    expect(ig.followersSeries).toEqual({ "2026-10-03": 100, "2026-10-02": 95, "2026-10-01": 92 });
  });
});

describe("metaAds", () => {
  it("sums daily totals and maps campaigns with results", async () => {
    mockGraph((url) => {
      if (url.pathname.endsWith("/campaigns")) return { body: { data: [{ id: "c1", updated_time: "2026-09-30T10:00:00+0000" }] } };
      if (url.searchParams.get("level") === "campaign")
        return {
          body: {
            data: [
              {
                campaign_id: "c1",
                campaign_name: "Mensajes octubre",
                objective: "OUTCOME_ENGAGEMENT",
                impressions: "3000",
                reach: "2000",
                clicks: "60",
                spend: "15.5",
                actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "9" }],
              },
            ],
          },
        };
      return {
        body: {
          data: [
            { date_start: "2026-10-01", impressions: "1000", reach: "800", clicks: "20", spend: "5.5" },
            { date_start: "2026-10-02", impressions: "2000", reach: "1500", clicks: "40", spend: "10" },
          ],
        },
      };
    });
    const ads = await metaAds("act_1", "tok", { since: "2026-10-01", until: "2026-10-02" }, "COP");
    expect(ads.totals).toEqual({ impressions: 3000, reach: 2300, clicks: 60, spend: 15.5 });
    expect(ads.daily["2026-10-02"].spend).toBe(10);
    expect(ads.campaigns[0]).toMatchObject({ id: "c1", name: "Mensajes octubre", results: 9, spend: 15.5, updatedAt: "2026-09-30T10:00:00+0000" });
  });
});
