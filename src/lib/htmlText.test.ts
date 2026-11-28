import { describe, expect, it } from "vitest";
import { editableTextRanges, markEditableText, replaceEditableText } from "./htmlText";

const texts = (html: string) => editableTextRanges(html).map((r) => html.slice(r.start, r.end).trim());

describe("editableTextRanges", () => {
  it("finds the visible texts in order and skips code, comments and attributes", () => {
    const html = `<!doctype html><html><head><title>Mi página</title><style>.a>b{color:red}</style></head><body>
      <!-- <p>oculto</p> -->
      <h1 class="a>b" title="no">Hola mundo</h1>
      <script>var x = "<p>no</p>";</script>
      <p>Segundo <b>texto</b> aquí</p>
      <svg><text>logo</text></svg>
      <a href="#" data-x='>'>Entrar</a>
    </body></html>`;
    expect(texts(html)).toEqual(["Hola mundo", "Segundo", "texto", "aquí", "Entrar"]);
  });
  it("treats a lone < as text and ignores blank spans", () => {
    expect(texts("<p>a < b y c</p><p>&nbsp;</p><p>  </p>")).toEqual(["a < b y c"]);
  });
  it("works on fragments with no html or body tags", () => {
    expect(texts('<div><button class="x">EMPEZAR →</button></div>')).toEqual(["EMPEZAR →"]);
  });
});

describe("markEditableText", () => {
  it("wraps each text and keeps everything else exactly", () => {
    const html = '<h1 id="t">Hola</h1><p>Chao</p>';
    expect(markEditableText(html)).toBe('<h1 id="t"><span data-fl-t="0">Hola</span></h1><p><span data-fl-t="1">Chao</span></p>');
  });
});

describe("replaceEditableText", () => {
  it("changes only that text, escaped, keeping the surrounding whitespace and code", () => {
    const html = '<div>\n  <h1 onclick="a(1)">Hola</h1>\n  <p>Chao & adiós</p>\n</div>';
    const out = replaceEditableText(html, 1, "Nuevo <b>texto</b> & más");
    expect(out).toBe('<div>\n  <h1 onclick="a(1)">Hola</h1>\n  <p>Nuevo &lt;b&gt;texto&lt;/b&gt; &amp; más</p>\n</div>');
    expect(editableTextRanges(out!).length).toBe(editableTextRanges(html).length);
  });
  it("refuses an empty text or a missing index", () => {
    expect(replaceEditableText("<p>Hola</p>", 0, "   ")).toBeNull();
    expect(replaceEditableText("<p>Hola</p>", 3, "x")).toBeNull();
  });
});
