// A hidden "honeypot" field on the public forms: people never see it, form-
// filling bots do and fill it in (see lib/abuseGuard.ts). No dependencies, so
// the page templates can import it.

/** Name of the hidden field; real visitors leave it empty. */
export const HONEYPOT_FIELD = "website_url";

/** The hidden field as HTML, for the server-rendered client pages. */
export const HONEYPOT_HTML = `<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><label>No llenar este campo<input type="text" name="${HONEYPOT_FIELD}" tabindex="-1" autocomplete="off"></label></div>`;
