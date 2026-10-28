import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/appointmentMessaging", () => ({ lastCustomerMessageAt: vi.fn(), sendAppointmentMessage: vi.fn() }));
vi.mock("@/lib/subscription", () => ({ isSubscriptionActive: vi.fn() }));
import { isTomorrow, localDateKey } from "./appointmentDayBefore";

describe("localDateKey / isTomorrow", () => {
  // 16:00 in Bogotá (UTC-5) on 2026-10-28.
  const now = new Date("2026-10-28T21:00:00Z");

  it("names the day in the business's own time zone", () => {
    expect(localDateKey(new Date("2026-10-29T03:00:00Z"), "America/Bogota")).toBe("2026-10-28"); // 22:00 the day before in Bogotá
    expect(localDateKey(new Date("2026-10-29T05:00:00Z"), "America/Bogota")).toBe("2026-10-29");
  });

  it("is true only for the next calendar day", () => {
    expect(isTomorrow(new Date("2026-10-29T15:00:00Z"), now, "America/Bogota")).toBe(true); // tomorrow 10:00
    expect(isTomorrow(new Date("2026-10-29T04:30:00Z"), now, "America/Bogota")).toBe(false); // tonight 23:30
    expect(isTomorrow(new Date("2026-10-30T15:00:00Z"), now, "America/Bogota")).toBe(false); // in two days
    expect(isTomorrow(new Date("2026-10-28T23:00:00Z"), now, "America/Bogota")).toBe(false); // today
  });
});
