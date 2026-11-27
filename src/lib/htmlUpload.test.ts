import { describe, expect, it } from "vitest";
import { checkUploadedHtml, htmlBlockFromContent } from "./htmlBlock";
import { SITE_SCRIPT } from "./siteScript";
import { applyBlockOp } from "./websiteBlocks";
import { setTextAtPath } from "./websiteEdit";
import { LOOK_CSS, LookSchema, lookParts, mergeLook } from "./websiteLook";
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

  it("the gallery has three layouts: grid, mosaic and a sliding banner", () => {
    const base = { ...buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" }), fullHtml: false };
    const withGallery = { ...base, sections: [base.sections[0], { type: "gallery" as const, kicker: null, heading: "Mira", media: undefined }] } as unknown as typeof base;
    const photos = ["https://x.co/a.jpg", "https://x.co/b.jpg", "https://x.co/c.jpg", "https://x.co/d.jpg"];
    const draw = (layout?: "grid" | "mosaic" | "carousel") => renderWebsiteHtmlV2({ ...withGallery, sections: [withGallery.sections[0], { ...(withGallery.sections[1] as object), ...(layout ? { layout } : {}) } as never] }, { ...ctx, photos });
    expect(draw()).toContain('class="gallery g4"');
    expect(draw("mosaic")).toContain('class="gal-mosaic"');
    const slider = draw("carousel");
    expect(slider).toContain("data-slider");
    expect(slider).not.toContain('class="gallery g4"');
    expect(SITE_SCRIPT).toContain("[data-slider]");
  });

  it("the layout op only works on a gallery and 'grid' goes back to the default", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const page = { ...base, sections: [base.sections[0], { type: "gallery", kicker: null, heading: "Mira" }] } as unknown as typeof base;
    const set = applyBlockOp(page, { kind: "galleryLayout", index: 1, layout: "carousel" });
    expect(set.ok && (set.content.sections[1] as { layout?: string }).layout).toBe("carousel");
    const back = set.ok ? applyBlockOp(set.content, { kind: "galleryLayout", index: 1, layout: "grid" }) : set;
    expect(back.ok && "layout" in back.content.sections[1]).toBe(false);
    expect(applyBlockOp(page, { kind: "galleryLayout", index: 0, layout: "mosaic" }).ok).toBe(false);
  });

  it("the boxes of a block have their own color, apart from the text and the background", () => {
    const parts = lookParts({ bg: "#111111", color: "#ffffff", surface: "#333333" });
    expect(parts.classes).toEqual(expect.arrayContaining(["lk-bg", "lk-c", "lk-s"]));
    expect(parts.vars["--lks"]).toBe("#333333");
    expect(lookParts({ surface: "#333333" }).classes).toEqual(["lk-s"]);
    expect(LOOK_CSS.indexOf(".lk-s{")).toBeGreaterThan(LOOK_CSS.indexOf(".lk-bg{"));
    expect(mergeLook({ bg: "#111111" }, { surface: "#333333" })).toEqual({ bg: "#111111", surface: "#333333" });
  });

  it("a block can have its own title size, text size and fonts", () => {
    const parts = lookParts({ titleScale: "130", textScale: "110", headingFont: "Playfair Display", bodyFont: "Inter" });
    expect(parts.vars["--ts"]).toBe("1.3");
    expect(parts.vars["--lkbs"]).toBe("1.1");
    expect(parts.vars["--hf"]).toContain("Playfair Display");
    expect(parts.vars["--hf"]).toContain("serif");
    expect(parts.classes).toEqual(expect.arrayContaining(["lk-bs", "lk-bf"]));
    expect(LookSchema.parse({ titleScale: "20", headingFont: "<script>" })).toEqual({ titleScale: null, headingFont: null });
  });

  it("elements added inside a block (text, button, photo) go right under its title", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const page = { ...base, fullHtml: false, sections: [base.sections[0], { type: "gallery", kicker: null, heading: "Mira" }] } as unknown as typeof base;
    const extras = [{ type: "text", text: "Una descripción" }, { type: "button", label: "Escríbenos", url: "https://example.com" }, { type: "image", url: "https://x.co/a.jpg" }];
    const done = applyBlockOp(page, { kind: "extras", index: 1, extras });
    expect(done.ok).toBe(true);
    const html = done.ok ? renderWebsiteHtmlV2(done.content, { ...ctx, photos: ["https://x.co/a.jpg"] }) : "";
    expect(html).toMatch(/<\/h2><div class="extras"><p class="extra-text">Una descripción<\/p><a class="btn extra-btn" href="https:\/\/example.com"[^>]*>Escríbenos<\/a><img class="extra-img" src="https:\/\/x.co\/a.jpg"/);
    // A button link must be https://, tel:, mailto: or #; a script address is refused.
    expect(applyBlockOp(page, { kind: "extras", index: 1, extras: [{ type: "button", label: "x", url: "javascript:alert(1)" }] }).ok).toBe(false);
    expect(applyBlockOp(page, { kind: "extras", index: 1, extras: Array.from({ length: 7 }, () => ({ type: "text", text: "a" })) }).ok).toBe(false);
    const cleared = done.ok ? applyBlockOp(done.content, { kind: "extras", index: 1, extras: [] }) : done;
    expect(cleared.ok && "extras" in cleared.content.sections[1]).toBe(false);
  });
  it("one text of a block can have its own color, without touching the rest", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const page = { ...base, fullHtml: false, sections: [base.sections[0], { type: "gallery", kicker: null, heading: "Mira" }] } as unknown as typeof base;
    const done = applyBlockOp(page, { kind: "fieldColor", index: 1, key: "heading", color: "#e11d48" });
    expect(done.ok).toBe(true);
    const html = done.ok ? renderWebsiteHtmlV2(done.content, ctx) : "";
    expect(html).toContain('data-fc="sections.1.heading"');
    expect(html).toContain('[data-fc="sections.1.heading"]{color:#e11d48!important}');
    // Only a real hex color and a plain key are accepted.
    expect(applyBlockOp(page, { kind: "fieldColor", index: 1, key: "heading", color: "red;}</style>" }).ok).toBe(false);
    expect(applyBlockOp(page, { kind: "fieldColor", index: 1, key: 'x"]{', color: "#ffffff" }).ok).toBe(false);
    // null brings the automatic color back and leaves no trace.
    const back = done.ok ? applyBlockOp(done.content, { kind: "fieldColor", index: 1, key: "heading", color: null }) : done;
    expect(back.ok && "fc" in back.content.sections[1]).toBe(false);
  });
  it("a block can have its own structure (columns)", () => {
    expect(lookParts({ cols: "2-1" }).classes).toContain("lk-cols-2-1");
    expect(LookSchema.parse({ cols: "9" })).toEqual({ cols: null });
    expect(LOOK_CSS).toContain(".lk-cols-3 :is(");
    expect(LOOK_CSS).toContain("minmax(0,2fr) minmax(0,1fr)");
  });
  it("the page's own top bar and footer: logo, menu colors, footer texts", () => {
    const base = buildHtmlPageContent({ businessName: "Mi Negocio", html: "<p>Hola</p>" });
    const page = { ...base, fullHtml: false, plain: false, chrome: { logo: "https://x.co/logo.png", headerBg: "#112233", headerColor: "#ffffff", headerBtn: "#e11d48", footerText: "Todos los derechos", footerLink: "Hablemos", footerBg: "#000000" } } as unknown as typeof base;
    const html = renderWebsiteHtmlV2(page, ctx);
    expect(html).toContain('<a class="brand brand-logo" href="#inicio"><img src="https://x.co/logo.png"');
    expect(html).toContain("--hbg:#112233");
    expect(html).toContain("--hbtn:#e11d48");
    expect(html).toContain(">Todos los derechos</span>");
    expect(html).toContain(">Hablemos</a>");
    expect(html).toContain("--fbg:#000000");
    // Not a color: ignored, nothing injected.
    const bad = renderWebsiteHtmlV2({ ...page, chrome: { headerBg: "red;}</style><script>", brandName: "Otra marca" } } as unknown as typeof base, ctx);
    expect(bad).not.toContain("red;}");
    expect(bad).toContain(">Otra marca</a>");
    // A button color only for one block.
    expect(lookParts({ btn: "#e11d48" }).classes).toContain("lk-btn");
    expect(lookParts({ btn: "#e11d48" }).vars["--lkbtn"]).toBe("#e11d48");
  });
  it("buttons can be square, soft or round: for the whole page or for one block", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    expect(renderWebsiteHtmlV2({ ...base, fullHtml: false, btnShape: "square" } as unknown as typeof base, ctx)).toContain("--br:0px;");
    expect(renderWebsiteHtmlV2({ ...base, fullHtml: false, btnShape: "round" } as unknown as typeof base, ctx)).toContain("--br:999px;");
    expect(lookParts({ btnShape: "soft" }).classes).toContain("lk-bsh-soft");
    expect(LookSchema.parse({ btnShape: "triangle" })).toEqual({ btnShape: null });
    expect(LOOK_CSS).toContain(".lk-bsh-square .btn{border-radius:0!important}");
  });
  it("each button can go to a link of its own", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const hero = { type: "hero", variant: "centered", heading: "Hola", subheading: "x", ctaLabel: "Quiero mi llamada", secondaryCtaLabel: "Ver más", eyebrow: null, badge: null, chips: [] };
    const page = { ...base, fullHtml: false, plain: false, sections: [hero] } as unknown as typeof base;
    const done = applyBlockOp(page, { kind: "buttonLink", index: 0, key: "ctaLabel", url: "https://landing.example.com/a" });
    expect(done.ok).toBe(true);
    const html = done.ok ? renderWebsiteHtmlV2(done.content, ctx) : "";
    expect(html).toMatch(/<a href="https:\/\/landing\.example\.com\/a" target="_blank" rel="noopener" class="btn"[^>]*>Quiero mi llamada<\/a>/);
    // The other button keeps the page's own link.
    expect(html).toMatch(/<a class="btn btn-ghost" href="#[^"]+"[^>]*>Ver más<\/a>/);
    // A script address is refused; null puts the button back.
    expect(applyBlockOp(page, { kind: "buttonLink", index: 0, key: "ctaLabel", url: "javascript:alert(1)" }).ok).toBe(false);
    const back = done.ok ? applyBlockOp(done.content, { kind: "buttonLink", index: 0, key: "ctaLabel", url: null }) : done;
    expect(back.ok && "links" in back.content.sections[0]).toBe(false);
    // The top bar's button too.
    const head = renderWebsiteHtmlV2({ ...page, chrome: { headerLink: "https://agenda.example.com", headerLabel: "Agenda ya" } } as unknown as typeof base, ctx);
    expect(head).toMatch(/<a href="https:\/\/agenda\.example\.com" target="_blank" rel="noopener" class="btn"[^>]*>Agenda ya<\/a>/);
  });
  it("the numbers, the menu names and the form button can be written by the owner", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const steps = { type: "steps", variant: "cards", kicker: null, heading: "Así", items: [{ title: "Uno", description: "a" }, { title: "Dos", description: "b" }] };
    const page = { ...base, fullHtml: false, plain: false, sections: [base.sections[0], steps] } as unknown as typeof base;
    const num = setTextAtPath(page, "sections.1.nums.i0", "A1");
    expect(num.ok).toBe(true);
    const nav = num.ok ? setTextAtPath(num.content, "sections.1.navLabel", "Mi proceso") : num;
    expect(nav.ok).toBe(true);
    const html = nav.ok ? renderWebsiteHtmlV2(nav.content, { ...ctx, preview: true, edit: true }) : "";
    expect(html).toMatch(/<span class="step-n" data-edit="sections\.1\.nums\.i0">A1<\/span>/);
    expect(html).toMatch(/<span class="step-n" data-edit="sections\.1\.nums\.i1">02<\/span>/);
    expect(html).toMatch(/<a href="#como-funciona" data-edit="sections\.1\.navLabel">Mi proceso<\/a>/);
    // Empty goes back to the automatic one.
    const back = nav.ok ? setTextAtPath(nav.content, "sections.1.nums.i0", "") : nav;
    expect(back.ok && "nums" in back.content.sections[1]).toBe(false);
    expect(setTextAtPath(page, "sections.1.nums.<b>", "x").ok).toBe(false);
  });
  it("one button can have its own background, text color and shape", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const hero = { type: "hero", variant: "centered", heading: "Hola", subheading: "x", ctaLabel: "Quiero mi llamada", secondaryCtaLabel: null, eyebrow: null, badge: null, chips: [] };
    const page = { ...base, fullHtml: false, plain: false, sections: [hero] } as unknown as typeof base;
    const done = applyBlockOp(page, { kind: "buttonStyle", index: 0, key: "ctaLabel", patch: { bg: "#112233", shape: "square" } });
    expect(done.ok).toBe(true);
    const html = done.ok ? renderWebsiteHtmlV2(done.content, ctx) : "";
    expect(html).toContain('data-bs="sections.0.ctaLabel"');
    expect(html).toMatch(/a\.btn\[data-bs="sections\.0\.ctaLabel"\]\[data-bs="sections\.0\.ctaLabel"\]\[data-bs="sections\.0\.ctaLabel"\]\{background:#112233!important;border-color:#112233!important;color:#[0-9a-f]{6}!important;border-radius:0px!important;\}/);
    expect(applyBlockOp(page, { kind: "buttonStyle", index: 0, key: "ctaLabel", patch: { bg: "red;}" } }).ok).toBe(false);
    expect(applyBlockOp(page, { kind: "buttonStyle", index: 0, key: "ctaLabel", patch: { shape: "star" } }).ok).toBe(false);
    const back = done.ok ? applyBlockOp(done.content, { kind: "buttonStyle", index: 0, key: "ctaLabel", patch: { bg: null, shape: null } }) : done;
    expect(back.ok && "bs" in back.content.sections[0]).toBe(false);
  });
  it("a Contenedor: pick a structure, put elements in its columns, change the structure and they are laid out again", () => {
    const base = buildHtmlPageContent({ businessName: "X", html: "<p>Hola</p>" });
    const page = { ...base, fullHtml: false, plain: false, sections: [base.sections[0], { type: "layout", structure: null, cells: [] }] } as unknown as typeof base;
    // Empty: the page offers the structures.
    const empty = renderWebsiteHtmlV2(page, { ...ctx, preview: true, edit: true });
    expect(empty).toContain("Selecciona tu estructura");
    expect(empty).toContain('data-struct="2x2"');
    const three = applyBlockOp(page, { kind: "layoutStructure", index: 1, structure: "3" });
    expect(three.ok && (three.content.sections[1] as unknown as { cells: unknown[] }).cells.length).toBe(3);
    const filled = three.ok ? applyBlockOp(three.content, { kind: "cellItems", index: 1, cell: 0, items: [{ type: "heading", text: "Hola" }, { type: "text", text: "Un texto" }] }) : three;
    const more = filled.ok ? applyBlockOp(filled.content, { kind: "cellItems", index: 1, cell: 2, items: [{ type: "button", label: "Ir", url: "https://x.co/a" }] }) : filled;
    expect(more.ok).toBe(true);
    const html = more.ok ? renderWebsiteHtmlV2(more.content, { ...ctx, preview: true, edit: true }) : "";
    expect(html).toContain('<h3 class="extra-h" data-edit="sections.1.cells.0.items.0.text">Hola</h3>');
    expect(html).toContain('data-edit="sections.1.cells.2.items.0.label"');
    expect(html).toContain('grid-column:span 4');
    // Another structure: the 3 elements keep their order in the new columns.
    const two = more.ok ? applyBlockOp(more.content, { kind: "layoutStructure", index: 1, structure: "2" }) : more;
    const cells = two.ok ? (two.content.sections[1] as unknown as { cells: { items: { type: string }[] }[] }).cells : [];
    expect(cells.map((c) => c.items.map((i) => i.type))).toEqual([["heading", "text"], ["button"]]);
    // A script link in a button, a column that does not exist and an unknown structure are refused.
    expect(applyBlockOp(three.ok ? three.content : page, { kind: "cellItems", index: 1, cell: 0, items: [{ type: "button", label: "x", url: "javascript:alert(1)" }] }).ok).toBe(false);
    expect(applyBlockOp(three.ok ? three.content : page, { kind: "cellItems", index: 1, cell: 9, items: [] }).ok).toBe(false);
    expect(applyBlockOp(page, { kind: "layoutStructure", index: 1, structure: "99" }).ok).toBe(false);
    // The published page shows no empty container.
    expect(renderWebsiteHtmlV2(page, ctx)).not.toContain("data-struct");
    // Text inside a column can be written.
    const edited = more.ok ? setTextAtPath(more.content, "sections.1.cells.0.items.0.text", "Nuevo título") : null;
    expect(edited && edited.ok && (edited.content.sections[1] as unknown as { cells: { items: { text: string }[] }[] }).cells[0].items[0].text).toBe("Nuevo título");
  });
});
