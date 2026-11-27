// Part of a text in its own color ("pick some words and change only their color").
//
// The stored text of a field carries the colored parts between two invisible separators:
//   ⁣#e11d48⁤colored words⁣
// Nothing else about the text changes, so every field keeps being a plain string. The public page
// turns the marks into <span style="color:…">; anything that reads the text for another purpose
// (the title of the tab, the list of blocks) takes them out with stripMarks.

export const MARK_OPEN = "⁣";
export const MARK_MID = "⁤";

const PAIR = /⁣(#[0-9a-fA-F]{6})⁤([^⁣]*)⁣/g;
const STRAY = /[⁣⁤]/g;

/** The text as people read it: no marks. */
export function stripMarks(text: string): string {
  return text.replace(PAIR, "$2").replace(STRAY, "");
}

/** The text as pieces: each with its own color, or null for the automatic one. Broken marks are dropped. */
export function parseMarks(text: string): { text: string; color: string | null }[] {
  const out: { text: string; color: string | null }[] = [];
  let last = 0;
  for (const m of text.matchAll(PAIR)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at).replace(STRAY, ""), color: null });
    if (m[2]) out.push({ text: m[2], color: m[1].toLowerCase() });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last).replace(STRAY, ""), color: null });
  return out.filter((p) => p.text !== "");
}

/** Pieces back into the stored text (neighbors of the same color are joined). */
export function joinMarks(parts: { text: string; color: string | null }[]): string {
  const merged: { text: string; color: string | null }[] = [];
  for (const p of parts) {
    if (!p.text) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.color === p.color) prev.text += p.text;
    else merged.push({ ...p });
  }
  return merged.map((p) => (p.color ? `${MARK_OPEN}${p.color}${MARK_MID}${p.text}${MARK_OPEN}` : p.text)).join("");
}

/**
 * Turns the marks of a finished page into colored spans. Inside a tag (an attribute) or in the
 * <title> they are only removed: a color there would show as text.
 */
export function renderMarks(html: string): string {
  if (!html.includes(MARK_OPEN)) return html;
  const withTitle = html.replace(/<title>[\s\S]*?<\/title>/i, (t) => stripMarks(t));
  return withTitle.replace(/<[^>]*>|[^<]+/g, (part) =>
    part.startsWith("<") ? stripMarks(part) : part.replace(PAIR, (_m, color: string, text: string) => `<span style="color:${color}">${text}</span>`).replace(STRAY, ""),
  );
}
