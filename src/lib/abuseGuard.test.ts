import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rateLimit", () => ({ isRateLimited: vi.fn(), recordRateLimitEvent: vi.fn() }));
const { clientIpFrom, isHoneypotFilled } = await import("./abuseGuard");

describe("abuseGuard", () => {
  it("reads the visitor IP from Vercel's first forwarded hop", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });

  it("flags a filled honeypot", () => {
    const human = new FormData();
    human.set("name", "Ana");
    const bot = new FormData();
    bot.set("website_url", "http://spam.example");
    expect(isHoneypotFilled(human)).toBe(false);
    expect(isHoneypotFilled(bot)).toBe(true);
  });
});
