import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
vi.mock("@/lib/rateLimit", () => ({ countRateLimitEvents: (...a: unknown[]) => count(...a), recordRateLimitEvent: vi.fn() }));

import { assertWebsiteGenerationAllowed, monthWindow, MONTHLY_WEBSITE_GENERATION_LIMIT } from "./websiteGenerationLimit";

describe("monthWindow", () => {
  it("starts the month at midnight in Bogotá (05:00 UTC) and ends it at the next one", () => {
    const { start, nextStart } = monthWindow(new Date("2026-11-13T15:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(nextStart.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("still belongs to the old month in the first hours of the 1st UTC (it is still the last night in Bogotá)", () => {
    const { start } = monthWindow(new Date("2026-12-01T02:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("rolls the year over in December", () => {
    expect(monthWindow(new Date("2026-12-20T12:00:00Z")).nextStart.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });
});

describe("assertWebsiteGenerationAllowed", () => {
  beforeEach(() => count.mockReset());

  it("allows changes until the month's limit is reached, counting from the start of the month", async () => {
    count.mockResolvedValue(MONTHLY_WEBSITE_GENERATION_LIMIT - 1);
    await expect(assertWebsiteGenerationAllowed("b1", new Date("2026-11-13T15:00:00Z"))).resolves.toBeUndefined();
    expect(count).toHaveBeenCalledWith("website-gen:b1", new Date("2026-11-01T05:00:00Z"));
  });

  it("says when it renews once the limit is reached", async () => {
    count.mockResolvedValue(MONTHLY_WEBSITE_GENERATION_LIMIT);
    await expect(assertWebsiteGenerationAllowed("b1", new Date("2026-11-13T15:00:00Z"))).rejects.toThrow(/4 cambios con IA.*1 de diciembre/);
  });
});
