// Finds the texts of an owner's HTML that can be edited by clicking them in the builder, without parsing
// and rewriting the whole document: only the exact characters of one text change, the rest of the code
// stays as the owner wrote it. Pure (used by the server and the tests).

/** Elements whose content is code or not drawn as page text. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "noscript", "xmp"]);
/** Elements inside which a wrapper tag around a text would break the drawing (or that hold no visible text). */
const NO_WRAP = new Set(["svg", "math", "head", "select", "template", "object", "iframe", "canvas", "audio", "video", "table-none"]);

export type TextRange = { start: number; end: number };

const BLANK_ENTITIES = /&(?:nbsp|ensp|emsp|thinsp|#160|#8203|#xa0);?/gi;

function hasVisibleText(raw: string): boolean {
  return raw.replace(BLANK_ENTITIES, "").trim().length > 0;
}

/** The editable texts of `html`, in document order (each a [start, end) range of the original string). */
export function editableTextRanges(html: string): TextRange[] {
  const ranges: TextRange[] = [];
  const depth = new Map<string, number>();
  const blocked = () => {
    for (const name of NO_WRAP) if ((depth.get(name) ?? 0) > 0) return true;
    return false;
  };
  const flush = (a: number, b: number) => {
    if (b > a && !blocked() && hasVisibleText(html.slice(a, b))) ranges.push({ start: a, end: b });
  };

  const n = html.length;
  let textStart = 0;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      flush(textStart, n);
      break;
    }
    if (html.startsWith("<!--", lt)) {
      flush(textStart, lt);
      const end = html.indexOf("-->", lt + 4);
      i = textStart = end === -1 ? n : end + 3;
      continue;
    }
    const next = html[lt + 1];
    if (next === "!" || next === "?") {
      flush(textStart, lt);
      const end = html.indexOf(">", lt);
      i = textStart = end === -1 ? n : end + 1;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 60));
    if (!m) {
      // A "<" that starts no tag ("a < b") is just text.
      i = lt + 1;
      continue;
    }
    flush(textStart, lt);
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    // End of the tag, skipping quoted attribute values.
    let j = lt + m[0].length;
    let quote = "";
    while (j < n) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
      j++;
    }
    const selfClosing = html[j - 1] === "/";
    i = textStart = Math.min(n, j + 1);
    if (closing) {
      if (NO_WRAP.has(name)) depth.set(name, Math.max(0, (depth.get(name) ?? 0) - 1));
      continue;
    }
    if (NO_WRAP.has(name) && !selfClosing) depth.set(name, (depth.get(name) ?? 0) + 1);
    if (RAW_TEXT.has(name) && !selfClosing) {
      // Its content is not page text: jump to its closing tag.
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      i = textStart = close === -1 ? n : close;
    }
  }
  return ranges;
}

/** The same HTML with every editable text wrapped in <span data-fl-t="index"> (only for the builder's editing frame). */
export function markEditableText(html: string): string {
  const ranges = editableTextRanges(html);
  let out = html;
  for (let k = ranges.length - 1; k >= 0; k--) {
    const { start, end } = ranges[k];
    out = `${out.slice(0, start)}<span data-fl-t="${k}">${out.slice(start, end)}</span>${out.slice(end)}`;
  }
  return out;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `html` with the editable text number `index` replaced; null when there is no such text or the new one is empty. */
export function replaceEditableText(html: string, index: number, newText: string): string | null {
  const range = editableTextRanges(html)[index];
  const text = newText.replace(/\r\n?/g, "\n").trim();
  if (!range || !text) return null;
  const raw = html.slice(range.start, range.end);
  const lead = /^\s*/.exec(raw)?.[0] ?? "";
  const tail = /\s*$/.exec(raw)?.[0] ?? "";
  return `${html.slice(0, range.start)}${lead}${escapeText(text)}${tail}${html.slice(range.end)}`;
}
