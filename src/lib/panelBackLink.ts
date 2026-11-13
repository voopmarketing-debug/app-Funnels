// "← Volver al panel" for the owner who opens a public page from the dashboard.
//
// The installed app (an iPhone home-screen app) has no address bar or back
// button, and /sitio/... is inside its scope, so "Ver página" used to open the
// page with no way out. The dashboard's links add ?desde=panel; the page then
// gets this pill. It is plain HTML + CSS (public pages allow no scripts) and
// only shows when running as an installed app, so visitors and ordinary
// browsers never see it.

export const FROM_PANEL_PARAM = "desde";
export const FROM_PANEL_VALUE = "panel";

/** The dashboard's link to a public page, marked so the page offers the way back. */
export function fromPanelUrl(publicUrl: string): string {
  return `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}${FROM_PANEL_PARAM}=${FROM_PANEL_VALUE}`;
}

export function wantsPanelBack(params: URLSearchParams): boolean {
  return params.get(FROM_PANEL_PARAM) === FROM_PANEL_VALUE;
}

const STYLE =
  "<style>.fl-panel-back{display:none;position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);align-items:center;gap:6px;padding:10px 16px;border-radius:999px;background:#0b0d08;color:#fff;font:600 14px/1 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.35)}@media (display-mode:standalone){.fl-panel-back{display:inline-flex}}</style>";

/** Adds the pill to a rendered page. `href` is a path inside this app, never user input. */
export function withPanelBackLink(html: string, href: string): string {
  const link = `${STYLE}<a class="fl-panel-back" href="${href}">← Volver al panel</a>`;
  return html.includes("</body>") ? html.replace("</body>", `${link}</body>`) : `${html}${link}`;
}
