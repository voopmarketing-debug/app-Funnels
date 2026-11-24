import { esc } from "@/lib/templateSite/shared";

// A page the owner has unpublished ("Borrador"): visitors get a short, neutral message and search
// engines are told to stay away; the owner (a member of the business) still sees the real page,
// with a ribbon saying nobody else can.

const SHELL = (title: string, body: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#f6f6f4;color:#17181a;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;text-align:center}main{max-width:26rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;color:#5b5f66}</style></head><body><main>${body}</main></body></html>`;

/** What a visitor sees at the link of a page that is not published. */
export function notPublishedHtml(): string {
  return SHELL("Página no disponible", `<h1>Esta página todavía no está publicada</h1><p>Vuelve a intentarlo más tarde.</p>`);
}

const RIBBON =
  "<style>.fl-draft{position:fixed;z-index:2147483646;top:0;left:50%;transform:translateX(-50%);background:#17181a;color:#fff;font:600 12px/1 system-ui,-apple-system,sans-serif;padding:7px 14px;border-radius:0 0 10px 10px;letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:none}</style><div class=\"fl-draft\">BORRADOR · solo tú ves esta página</div>";

/** The owner's view of a draft. */
export function withDraftRibbon(html: string): string {
  return html.includes("</body>") ? html.replace("</body>", `${RIBBON}</body>`) : `${html}${RIBBON}`;
}

/** Where the visitor goes after sending the form: the owner's thank-you link, if the page has a valid one. */
export function thankYouTarget(content: unknown): string | null {
  const url = typeof content === "object" && content !== null ? (content as { thankYouUrl?: unknown }).thankYouUrl : null;
  if (typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url) || url.length > 500) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

/** The page's policy lets its form send the visitor on to the owner's thank-you page (browsers check redirects after a form against form-action). */
export function allowThankYouRedirect(headers: Record<string, string>, content: unknown): Record<string, string> {
  const target = thankYouTarget(content);
  const policy = headers["Content-Security-Policy"];
  if (!target || !policy) return headers;
  const origin = new URL(target).origin;
  return { ...headers, "Content-Security-Policy": policy.replace("form-action 'self'", `form-action 'self' ${origin}`) };
}
