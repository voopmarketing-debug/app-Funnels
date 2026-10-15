import { describe, expect, it } from "vitest";
import { lookParts, mergeLook, tidyLook } from "./websiteLook";
import { WebsiteContentV2Schema } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";

describe("look helpers", () => {
  it("keeps only what is set", () => {
    expect(tidyLook({ bg: null, color: null, padY: null })).toBeUndefined();
    expect(tidyLook({ bg: "#112233", padY: null })).toEqual({ bg: "#112233" });
    expect(mergeLook({ bg: "#112233", align: "center" }, { bg: null })).toEqual({ align: "center" });
  });

  it("makes the text readable on its own when only a background is chosen", () => {
    expect(lookParts({ bg: "#101010" }).vars["--lkc"]).toBe("#ffffff");
    expect(lookParts({ bg: "#f5f5f5" }).vars["--lkc"]).toBe("#0a0a0a");
    expect(lookParts({ bg: "#101010", color: "#ffcc00" }).vars["--lkc"]).toBe("#ffcc00");
  });

  it("lets a photo win over a background color, and never hides a block in the builder", () => {
    expect(lookParts({ bg: "#101010" }, { photoBg: true }).classes).not.toContain("lk-bg");
    expect(lookParts({ hideOn: "mobile" }).classes).toContain("lk-hide-m");
    expect(lookParts({ hideOn: "mobile" }, { showAll: true }).classes).not.toContain("lk-hide-m");
  });
});

const content = (look: unknown) =>
  WebsiteContentV2Schema.parse({
    version: 2,
    pageType: "servicios",
    style: "clinico",
    announcement: null,
    theme: { primaryColor: "#0f766e", backgroundColor: "#f6f8f7", surfaceColor: "#e9efed", textColor: "#13201d", headingFont: "Inter", bodyFont: "Inter" },
    sections: [
      { type: "hero", variant: "centered", eyebrow: null, heading: "Hola", highlight: null, subheading: "Mundo", chips: [], showLeadForm: false, ctaLabel: "Ir", secondaryCtaLabel: null, badge: null, productId: null },
      { type: "features", variant: "cards", kicker: null, heading: "Beneficios", intro: null, items: [{ icon: "check", title: "A", description: "B" }], look },
    ],
    hidden: [],
    heroCtaUrl: null,
  });

describe("a section's look on the page", () => {
  const ctx = { businessName: "X", trackingBasePath: "/sitio/x" };

  it("adds the classes and variables to that section only", () => {
    const html = renderWebsiteHtmlV2(content({ bg: "#101010", padY: "lg", align: "center", size: "xl" }), ctx);
    expect(html).toMatch(/<section class="sec lk-bg lk-c lk-p-lg lk-a-center lk-t-xl" id="detalles" style="--lkbg:#101010;--lkc:#ffffff">/);
    expect(html.match(/lk-bg lk-c/g)).toHaveLength(1);
  });

  it("renders a page without looks exactly as before", () => {
    expect(renderWebsiteHtmlV2(content(undefined), ctx)).not.toMatch(/<section[^>]*lk-/);
  });

  it("ignores anything that is not a known value", () => {
    const html = renderWebsiteHtmlV2(content({ bg: "red;}body{display:none", padY: "huge", hideOn: "tv" }), ctx);
    expect(html).not.toContain("body{display:none");
    expect(html).not.toMatch(/<section[^>]*lk-/);
  });

  it("hides a block on a screen size only on the public page", () => {
    expect(renderWebsiteHtmlV2(content({ hideOn: "mobile" }), ctx)).toMatch(/<section[^>]*lk-hide-m/);
    expect(renderWebsiteHtmlV2(content({ hideOn: "mobile" }), { ...ctx, preview: true, edit: true })).not.toMatch(/<section[^>]*lk-hide-m/);
  });
});
