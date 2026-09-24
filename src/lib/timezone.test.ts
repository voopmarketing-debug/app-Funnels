import { describe, expect, it } from "vitest";
import { zonedTimeToUtc, formatDateInZone, formatTimeInZone } from "@/lib/timezone";

describe("zonedTimeToUtc", () => {
  it("converts a Bogotá (UTC-5, no DST) wall-clock time to the correct UTC instant", () => {
    const utc = zonedTimeToUtc("2026-09-24", "09:00", "America/Bogota");
    expect(utc.toISOString()).toBe("2026-09-24T14:00:00.000Z");
  });

  it("converts a Madrid summer (UTC+2, DST active in September) wall-clock time correctly", () => {
    const utc = zonedTimeToUtc("2026-09-24", "09:00", "Europe/Madrid");
    expect(utc.toISOString()).toBe("2026-09-24T07:00:00.000Z");
  });

  it("round-trips through formatDateInZone/formatTimeInZone back to the original wall-clock values", () => {
    const utc = zonedTimeToUtc("2026-12-15", "14:30", "America/Bogota");
    expect(formatDateInZone(utc, "America/Bogota")).toBe("2026-12-15");
    expect(formatTimeInZone(utc, "America/Bogota")).toBe("14:30");
  });
});
