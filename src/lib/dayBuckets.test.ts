import { describe, expect, it } from "vitest";
import { bucketDays, bucketLongLabel, bucketShortLabel, bucketUnitFor } from "./dayBuckets";
import { daysIn } from "./metaSocial";

describe("bucketDays", () => {
  it("picks days, weeks or months by length", () => {
    expect(bucketUnitFor(30)).toBe("day");
    expect(bucketUnitFor(90)).toBe("week");
    expect(bucketUnitFor(365)).toBe("month");
  });

  it("groups a year into 13 calendar months, partial ones included", () => {
    const b = bucketDays(daysIn({ since: "2025-10-14", until: "2026-10-13" }));
    expect(b).toHaveLength(13);
    expect(b[0]).toMatchObject({ key: "2025-10", from: "2025-10-14", to: "2025-10-31" });
    expect(bucketShortLabel(b[0])).toBe("oct 25");
    expect(bucketLongLabel(b[12])).toBe("octubre 2026");
  });

  it("starts weeks on Monday", () => {
    // 2026-10-07 is a Wednesday.
    const b = bucketDays(daysIn({ since: "2026-10-07", until: "2026-10-20" }), "week");
    expect(b.map((x) => [x.from, x.to])).toEqual([
      ["2026-10-07", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
      ["2026-10-19", "2026-10-20"],
    ]);
    expect(bucketLongLabel(b[1])).toBe("semana del 12 al 18 oct");
  });
});
