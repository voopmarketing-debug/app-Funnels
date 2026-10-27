import { describe, expect, it } from "vitest";
import { escapeHtml } from "./htmlEscape";

describe("escapeHtml", () => {
  it("neutralises markup typed into a name", () => {
    expect(escapeHtml('<a href="https://evil.test">Pague aquí</a> & más')).toBe("&lt;a href=&quot;https://evil.test&quot;&gt;Pague aquí&lt;/a&gt; &amp; más");
  });
  it("handles empty values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
