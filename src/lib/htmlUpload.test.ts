import { describe, expect, it } from "vitest";
import { checkUploadedHtml, htmlBlockFromContent } from "./htmlBlock";
import { SITE_SCRIPT } from "./siteScript";
import { SAMPLE_HTML } from "./htmlSample";
import { buildHtmlPageContent } from "./nicheTemplates";
import { incompleteHtmlReason, WebsiteContentV2Schema } from "./websiteContentV2";
import { renderWebsiteHtmlV2 } from "./websiteTemplateV2";

const ctx = { businessName: "Estudio Vértice", trackingBasePath: "/sitio/mi-pagina", preview: false, heroImageUrl: null, photos: [], products: [] };

describe("Subir mi HTML", () => {
  it("checks what is uploaded", () => {
    expect(checkUploadedHtml(SAMPLE_HTML)).toMatchObject({ ok: true });
    expect(checkUploadedHtml("﻿<p>Hola</p>")).toEqual({ ok: true, html: "<p>Hola</p>" });
    for (const bad of ["", "   ", "solo texto sin etiquetas", 42, null, "x".repeat(100_001) + "<p>"]) expect(checkUploadedHtml(bad).ok, String(bad).slice(0, 20)).toBe(false);
  });

  it("the example is a real page with a script that runs in the frame", () => {
    expect(SAMPLE_HTML).toContain("<script>");
    expect(SAMPLE_HTML).toContain("<form");
    expect(SAMPLE_HTML.length).toBeLessThan(30_000);
  });

  it("makes a page that is only the owner's html, shown in the isolated frame", () => {
    const content = buildHtmlPageContent({ businessName: "Estudio Vértice", html: SAMPLE_HTML, title: "Mi página" });
    expect(WebsiteContentV2Schema.safeParse(content).success).toBe(true);
    const html = renderWebsiteHtmlV2(content, ctx);
    expect(html).toContain('<iframe title="Mi página" src="/sitio/mi-pagina/bloque/1"');
    expect(html).toContain('sandbox="allow-scripts');
    expect(html).toContain("data-htmlframe");
    // Fills the screen and scrolls by itself: no height to measure, so a long page is never cut.
    expect(html).toMatch(/iframe\{position:fixed;[^}]*height:100%/);
    // Nothing of ours around it: no header, nav, footer or sections.
    expect(html).not.toMatch(/<header|<footer|class="hero|class="sec/);
    // The code itself is never inside the public page: it is served by the frame's own address.
    expect(html).not.toContain("Pide tu demo gratis");
    expect(htmlBlockFromContent(content, 1)).toContain("Pide tu demo gratis");
  });

  it("turns off with the switch; the builder preview shows the same page plus an edit-code button", () => {
    const content = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const off = renderWebsiteHtmlV2({ ...content, fullHtml: false }, ctx);
    expect(off).toContain("<header");
    const editing = renderWebsiteHtmlV2(content, { ...ctx, preview: true, edit: true });
    expect(editing).not.toContain("<header");
    expect(editing).toContain('data-code-edit="1"');
    expect(editing).toContain("/bloque/1?preview=1");
  });

  it("an empty or hidden html block falls back to the normal page", () => {
    const content = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    expect(renderWebsiteHtmlV2({ ...content, hidden: [1] }, ctx)).toContain("<header");
  });

  it("refuses code that was cut off halfway instead of making a blank page", () => {
    const cut = SAMPLE_HTML.slice(0, SAMPLE_HTML.indexOf("nav a.btn{padding:") + 18);
    expect(checkUploadedHtml(cut)).toMatchObject({ ok: false });
    expect(incompleteHtmlReason("<p>hola</p>")).toBeNull();
    expect(incompleteHtmlReason("<style>a{}</style><script src=\"x.js\"></script><div>ok</div>")).toBeNull();
    expect(incompleteHtmlReason("<div><script>var a=1;")).toMatch(/script/);
  });

  it("the frame carries the form bridge, and the page around it posts the contact to its own form address", () => {
    const doc = htmlBlockFromContent(buildHtmlPageContent({ businessName: "X", html: SAMPLE_HTML }), 1) ?? "";
    expect(doc).toContain("flLead");
    expect(doc.match(/flLead:/g)?.length).toBe(1);
    expect(SITE_SCRIPT).toContain("/registro");
    expect(SITE_SCRIPT).toContain("flLeadResult");
  });

  it("a plain page has no top bar and no footer of ours", () => {
    const content = { ...buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" }), fullHtml: false };
    expect(renderWebsiteHtmlV2(content, ctx)).toContain("<header");
    const plain = renderWebsiteHtmlV2({ ...content, plain: true }, ctx);
    expect(plain).not.toMatch(/<header|<footer/);
    expect(plain).toContain("data-htmlframe");
  });
});
