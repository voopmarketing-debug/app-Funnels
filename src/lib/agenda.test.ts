import { describe, expect, it } from "vitest";
import { getDayAvailability, getUpcomingAvailableDates, DEFAULT_AVAILABILITY, AvailabilitySchema, shiftMonthStr } from "@/lib/agenda";

describe("getDayAvailability", () => {
  it("maps a date string to the correct weekday regardless of timezone (2026-09-23 is a Wednesday)", () => {
    expect(getDayAvailability(DEFAULT_AVAILABILITY, "2026-09-23")).toEqual(DEFAULT_AVAILABILITY.wednesday);
  });

  it("correctly identifies a Sunday", () => {
    expect(getDayAvailability(DEFAULT_AVAILABILITY, "2026-09-27")).toEqual(DEFAULT_AVAILABILITY.sunday);
  });
});

describe("getUpcomingAvailableDates", () => {
  it("only returns dates whose weekday is enabled", () => {
    const mondayOnly = {
      ...DEFAULT_AVAILABILITY,
      tuesday: { ...DEFAULT_AVAILABILITY.tuesday, enabled: false },
      wednesday: { ...DEFAULT_AVAILABILITY.wednesday, enabled: false },
      thursday: { ...DEFAULT_AVAILABILITY.thursday, enabled: false },
      friday: { ...DEFAULT_AVAILABILITY.friday, enabled: false },
    };
    const dates = getUpcomingAvailableDates(mondayOnly, "America/Bogota", 3);
    expect(dates).toHaveLength(3);
    for (const d of dates) {
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      expect(weekday).toBe(1); // Monday
    }
  });

  it("returns an empty list when no day is enabled", () => {
    const noneEnabled = Object.fromEntries(
      Object.entries(DEFAULT_AVAILABILITY).map(([k, v]) => [k, { ...v, enabled: false }]),
    ) as typeof DEFAULT_AVAILABILITY;
    expect(getUpcomingAvailableDates(noneEnabled, "America/Bogota", 5)).toEqual([]);
  });
});

describe("shiftMonthStr", () => {
  it("moves forward a month within the same year", () => {
    expect(shiftMonthStr("2026-09", 1)).toBe("2026-10");
  });

  it("rolls over into the next year", () => {
    expect(shiftMonthStr("2026-12", 1)).toBe("2027-01");
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonthStr("2026-01", -1)).toBe("2025-12");
  });
});

describe("AvailabilitySchema", () => {
  it("parses a well-formed availability object", () => {
    expect(AvailabilitySchema.parse(DEFAULT_AVAILABILITY)).toEqual(DEFAULT_AVAILABILITY);
  });

  it("falls back to a safe default for a malformed day instead of throwing", () => {
    const malformed = { ...DEFAULT_AVAILABILITY, monday: { enabled: "yes", start: "9am", end: "5pm" } };
    const parsed = AvailabilitySchema.parse(malformed);
    expect(parsed.monday).toEqual({ enabled: false, start: "09:00", end: "17:00" });
  });
});
