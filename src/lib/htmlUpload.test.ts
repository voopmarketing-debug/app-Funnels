import { describe, expect, it } from "vitest";
import { checkUploadedHtml, htmlBlockFromContent } from "./htmlBlock";
import { SAMPLE_HTML } from "./htmlSample";
import { buildHtmlPageContent } from "./nicheTemplates";
import { WebsiteContentV2Schema } from "./websiteContentV2";
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
    expect(SAMPLE_HTML.length).toBeLessThan(10_000);
  });

  it("makes a page that is only the owner's html, shown in the isolated frame", () => {
    const content = buildHtmlPageContent({ businessName: "Estudio Vértice", html: SAMPLE_HTML, title: "Mi página" });
    expect(WebsiteContentV2Schema.safeParse(content).success).toBe(true);
    const html = renderWebsiteHtmlV2(content, ctx);
    expect(html).toContain('<iframe title="Mi página" src="/sitio/mi-pagina/bloque/1"');
    expect(html).toContain('sandbox="allow-scripts');
    expect(html).toContain("data-autoheight");
    // Nothing of ours around it: no header, nav, footer or sections.
    expect(html).not.toMatch(/<header|<footer|class="hero|class="sec/);
    // The code itself is never inside the public page: it is served by the frame's own address.
    expect(html).not.toContain("Esta página es tu propio HTML");
    expect(htmlBlockFromContent(content, 1)).toContain("Esta página es tu propio HTML");
  });

  it("turns off with the switch, and the editing preview keeps the normal layout", () => {
    const content = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const off = renderWebsiteHtmlV2({ ...content, fullHtml: false }, ctx);
    expect(off).toContain("<header");
    const editing = renderWebsiteHtmlV2(content, { ...ctx, preview: true, edit: true });
    expect(editing).toContain("<header");
    expect(editing).toContain("data-code-edit");
  });

  it("an empty or hidden html block falls back to the normal page", () => {
    const content = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    expect(renderWebsiteHtmlV2({ ...content, hidden: [1] }, ctx)).toContain("<header");
  });
});
