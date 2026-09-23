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

export function siteSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Security-Policy": SITE_CSP };
  for (const h of SECURITY_HEADERS) headers[h.key] = h.value;
  return headers;
}
