import { describe, expect, it } from "vitest";
import { withSiteTracking } from "./siteTracking";
import { SITE_SCRIPT_HASH } from "./siteScript";

describe("withSiteTracking", () => {
  it("keeps the page's own interaction script allowed next to the tracking nonce", () => {
    const out = withSiteTracking("<html><head></head><body></body></html>", {}, { metaPixelId: "123456789012345", googleTagId: null });
    const csp = out.headers["Content-Security-Policy"];
    expect(csp).toContain(`'sha256-${SITE_SCRIPT_HASH}'`);
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
  });

  it("leaves a page without tracking ids untouched", () => {
    const html = "<html><head></head><body></body></html>";
    expect(withSiteTracking(html, { a: "b" }, { metaPixelId: null, googleTagId: null })).toEqual({ html, headers: { a: "b" } });
  });
});
