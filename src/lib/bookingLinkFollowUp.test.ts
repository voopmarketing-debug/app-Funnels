import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/appointmentMessaging", () => ({ lastCustomerMessageAt: vi.fn(), normalizeRecipientPhone: (c: string) => c.replace(/\D/g, ""), sendAppointmentMessage: vi.fn() }));
vi.mock("@/lib/subscription", () => ({ isSubscriptionActive: vi.fn() }));
import { isSendingHour, phoneKey, shouldSkipLead, type LeadState } from "./bookingLinkFollowUp";

describe("isSendingHour", () => {
  it("allows 9:00 to 18:59 in the agenda's time zone, and nothing else", () => {
    // Bogotá is UTC-5.
    expect(isSendingHour(new Date("2026-10-28T14:00:00Z"), "America/Bogota")).toBe(true); // 09:00
    expect(isSendingHour(new Date("2026-10-28T21:00:00Z"), "America/Bogota")).toBe(true); // 16:00
    expect(isSendingHour(new Date("2026-10-29T00:00:00Z"), "America/Bogota")).toBe(false); // 19:00
    expect(isSendingHour(new Date("2026-10-28T13:59:00Z"), "America/Bogota")).toBe(false); // 08:59
    expect(isSendingHour(new Date("2026-10-28T08:00:00Z"), "America/Bogota")).toBe(false); // 03:00
  });
  it("uses the agenda's zone, not the server's", () => {
    expect(isSendingHour(new Date("2026-10-28T14:00:00Z"), "Europe/Madrid")).toBe(true); // 15:00
    expect(isSendingHour(new Date("2026-10-28T21:00:00Z"), "Europe/Madrid")).toBe(false); // 22:00
  });
});

describe("phoneKey", () => {
  it("matches the same phone however it was typed", () => {
    expect(phoneKey("+57 300 123 4567")).toBe("3001234567");
    expect(phoneKey("300-123-4567")).toBe("3001234567");
    expect(phoneKey("573001234567")).toBe("3001234567");
  });
});

describe("shouldSkipLead", () => {
  const free: LeadState = { hasAppointment: false, ficheHasAppointment: false, wroteAfterLead: false, needsHuman: false, alreadySent: false };

  it("messages a lead nobody has dealt with", () => {
    expect(shouldSkipLead(free)).toBe(false);
  });
  it.each([
    ["booked", { hasAppointment: true }],
    ["has an appointment on their ficha", { ficheHasAppointment: true }],
    ["wrote back", { wroteAfterLead: true }],
    ["is being handled by a person", { needsHuman: true }],
    ["already got the link", { alreadySent: true }],
  ] as const)("never messages someone who %s", (_label, change) => {
    expect(shouldSkipLead({ ...free, ...change })).toBe(true);
  });
});
