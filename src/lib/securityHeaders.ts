// Shared between next.config.ts (applies these to normal Next.js-routed
// requests, including /sitio/[slug] on this app's own domain) and
// proxy.ts (custom-domain requests never reach next.config's headers()
// layer — the middleware returns its own NextResponse directly — so they
// need to be attached by hand there too).

// Stricter CSP for the publicly-served, AI-generated business websites —
// this surface renders raw HTML built from business-editable content (see
// lib/websiteTemplate.ts) and has no inline <script> of its own, so
// script-src can be fully locked down. This is the defense-in-depth layer
// for the stored-XSS fix in lib/websiteContent.ts: even if a malicious
// <script> ever slipped past schema validation again, the browser would
// refuse to run it here.
export const SITE_CSP =
  "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; frame-src https://www.youtube.com https://player.vimeo.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Same set, minus `includeSubDomains`/`preload` on HSTS — used for requests
// on a CLIENT'S OWN connected domain (see proxy.ts's customDomain lookup).
// `includeSubDomains` would force HTTPS on every subdomain of that client's
// domain, not just the one they pointed here (e.g. their mail server or an
// unrelated internal tool on another subdomain) — an opt-in they never
// made. A plain max-age still HSTS-protects exactly the hostname they
// connected, without reaching into subdomains this app has no say over.
const CUSTOM_DOMAIN_HEADERS: { key: string; value: string }[] = SECURITY_HEADERS.map((h) =>
  h.key === "Strict-Transport-Security" ? { key: h.key, value: "max-age=31536000" } : h,
);

function buildHeaders(list: { key: string; value: string }[]): Record<string, string> {
  const headers: Record<string, string> = { "Content-Security-Policy": SITE_CSP };
  for (const h of list) headers[h.key] = h.value;
  return headers;
}

/** For the app's own domain (e.g. /sitio/[slug] on agente.funnelslabs.app). */
export function siteSecurityHeaders(): Record<string, string> {
  return buildHeaders(SECURITY_HEADERS);
}

/** For a client's connected custom domain — same policy, scoped-down HSTS (see CUSTOM_DOMAIN_HEADERS above). */
export function customDomainSecurityHeaders(): Record<string, string> {
  return buildHeaders(CUSTOM_DOMAIN_HEADERS);
}
