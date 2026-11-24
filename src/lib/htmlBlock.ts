import { WebsiteContentV2Schema } from "@/lib/websiteContentV2";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

// The "Código HTML" block: the owner pastes their own HTML (a widget, an embed, a form from another
// service, a script). It is never put inside the page itself: it is served from its own address and
// shown in a sandboxed frame, so it cannot read the platform's cookies or touch the page around it,
// and the page's own strict policy stays as it is.

/** The policy of the frame's own document: its scripts and external resources work, but the sandbox keeps it isolated. */
export const HTML_BLOCK_CSP =
  "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'";

// Reports the content height to the page around it (which sets the frame's height). Fixed text.
const AUTO_HEIGHT = `<script>(function(){function h(){var b=document.body,e=document.documentElement;return Math.max(b?b.scrollHeight:0,b?b.offsetHeight:0,e.offsetHeight);}function s(){try{parent.postMessage({flHtmlH:h()},"*");}catch(x){}}addEventListener("load",s);addEventListener("resize",s);if(window.ResizeObserver){new ResizeObserver(s).observe(document.documentElement);}setInterval(s,1500);s();})();</script>`;

/** The document a block's frame loads: the owner's code, opened links go to a new tab, plus the height reporter. */
export function htmlBlockDocument(code: string): string {
  const hasDoc = /<html[\s>]/i.test(code) || /<body[\s>]/i.test(code);
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">`;
  if (hasDoc) {
    const withHead = /<head[\s>]/i.test(code) ? code.replace(/<head([^>]*)>/i, `<head$1>${head}`) : code.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
    return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${AUTO_HEIGHT}</body>`) : `${withHead}${AUTO_HEIGHT}`;
  }
  return `<!doctype html><html><head>${head}<style>html,body{margin:0}</style></head><body>${code}${AUTO_HEIGHT}</body></html>`;
}

/** The document of block number `index` of a stored page, or null when that block is not a visible, filled-in HTML block. */
export function htmlBlockFromContent(content: unknown, index: number): string | null {
  const parsed = WebsiteContentV2Schema.safeParse(content);
  if (!parsed.success) return null;
  const section = parsed.data.sections[index];
  if (!section || section.type !== "html" || !section.code.trim() || parsed.data.hidden.includes(index)) return null;
  return htmlBlockDocument(section.code);
}

/** Headers of a block's frame response. */
export const HTML_BLOCK_HEADERS: Record<string, string> = {
  ...Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value])),
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": HTML_BLOCK_CSP,
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  // The owner edits this often; never serve an old copy.
  "Cache-Control": "no-store",
};
