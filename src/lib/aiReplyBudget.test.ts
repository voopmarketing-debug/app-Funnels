import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/push", () => ({ sendPushToBusiness: vi.fn() }));
vi.mock("@/lib/addons", () => ({ getAccountAddonCapacity: vi.fn() }));
const { replyBudgetMode } = await import("./aiReplyBudget");

describe("replyBudgetMode", () => {
  it("answers normally under the plan's monthly replies", () => {
    expect(replyBudgetMode(0, 6000)).toBe("normal");
    expect(replyBudgetMode(5999, 6000)).toBe("normal");
  });

  it("switches to the economical model for 20% past the limit instead of going quiet", () => {
    expect(replyBudgetMode(6000, 6000)).toBe("economy");
    expect(replyBudgetMode(7199, 6000)).toBe("economy");
  });

  it("stops once the overflow is used up", () => {
    expect(replyBudgetMode(7200, 6000)).toBe("paused");
  });

  it("never limits unlimited plans", () => {
    expect(replyBudgetMode(1_000_000, null)).toBe("normal");
  });
});
