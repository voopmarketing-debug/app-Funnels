import { describe, expect, it } from "vitest";
import { HTML_BLOCK_CSP, htmlBlockDocument, htmlBlockFromContent } from "./htmlBlock";
import { WebsiteContentV2Schema } from "./websiteContentV2";
import { applyBlockOp, newSection } from "./websiteBlocks";

const base = (sections: unknown[], hidden: number[] = []) =>
  WebsiteContentV2Schema.parse({
    version: 2,
    pageType: "captacion",
    style: "editorial",
    announcement: null,
    theme: { primaryColor: "#1f6feb", backgroundColor: "#ffffff", surfaceColor: "#f5f5f5", textColor: "#111111", headingFont: "Inter", bodyFont: "Inter" },
    sections: [{ type: "hero", variant: "blank", eyebrow: null, heading: "Hola", highlight: null, subheading: "", chips: [], showLeadForm: false, ctaLabel: "Escríbenos", secondaryCtaLabel: null, badge: null, productId: null }, ...sections],
    hidden,
    heroCtaUrl: null,
  });

describe("HTML block", () => {
  it("runs in a sandbox that never gets the platform's origin", () => {
    expect(HTML_BLOCK_CSP).toMatch(/^sandbox /);
    expect(HTML_BLOCK_CSP).not.toMatch(/allow-same-origin/);
    expect(HTML_BLOCK_CSP).not.toMatch(/allow-top-navigation/);
  });

  it("wraps a snippet and a full document, keeping the owner's code", () => {
    expect(htmlBlockDocument("<p>Hola</p>")).toContain("<body><p>Hola</p>");
    const full = htmlBlockDocument("<html><head><title>x</title></head><body><h1>Hi</h1></body></html>");
    expect(full).toContain("<h1>Hi</h1>");
    expect(full).toContain('<base target="_blank">');
    expect(full.match(/flHtmlH/g)?.length).toBe(1);
  });

  it("serves only visible, filled-in html blocks", () => {
    const content = base([{ type: "html", code: "<b>ok</b>", height: 0 }, { type: "html", code: "   ", height: 0 }]);
    expect(htmlBlockFromContent(content, 1)).toContain("<b>ok</b>");
    expect(htmlBlockFromContent(content, 2)).toBeNull();
    expect(htmlBlockFromContent(content, 0)).toBeNull();
    expect(htmlBlockFromContent(content, 9)).toBeNull();
    expect(htmlBlockFromContent({ nope: true }, 1)).toBeNull();
    expect(htmlBlockFromContent(base([{ type: "html", code: "<b>ok</b>", height: 0 }], [1]), 1)).toBeNull();
  });

  it("can be added to a page and its code saved, with limits", () => {
    const start = base([]);
    expect(newSection("html")).toEqual({ type: "html", code: "", height: 0 });
    const added = applyBlockOp(start, { kind: "add", type: "html" }, {});
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const saved = applyBlockOp(added.content, { kind: "html", index: added.focus, code: "<p>x</p>", height: 400 }, {});
    expect(saved.ok && saved.content.sections[added.focus]).toMatchObject({ type: "html", code: "<p>x</p>", height: 400 });
    expect(applyBlockOp(added.content, { kind: "html", index: 0, code: "x", height: 0 }, {}).ok).toBe(false);
    expect(applyBlockOp(added.content, { kind: "html", index: added.focus, code: "x".repeat(100_001), height: 0 }, {}).ok).toBe(false);
  });
});
