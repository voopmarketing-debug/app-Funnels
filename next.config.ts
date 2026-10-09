import type { NextConfig } from "next";
import { SECURITY_HEADERS, SITE_CSP } from "./src/lib/securityHeaders";

// Baseline CSP for the authenticated app (dashboard, login, landing pages —
// real Next.js/React routes). 'unsafe-inline' on script-src is needed for
// Next's own hydration bootstrap scripts (no nonce middleware is wired up);
// it still blocks loading any *external* script, which is what actually
// matters here. The only dangerouslySetInnerHTML is the static theme script
// in app/layout.tsx (a hardcoded constant, no user data).
// media-src explicitly set (not left to fall back to default-src 'self')
// because voice notes, image, and video attachments are all hosted on
// Vercel Blob's own domain, not this app's origin — without this, the
// <audio>/<video> players in the CRM's chat thread silently refuse to
// load anything, which is exactly what broke playback of sent/received
// voice notes right after this CSP first shipped.
const APP_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https://vercel.com/api/blob/; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const nextConfig: NextConfig = {
  // Server Actions cap request bodies at 1MB by default — too small for a
  // phone photo sent from the chat composer or an announcement image.
  // Vercel functions can't accept bodies past ~4.5MB anyway, so 4MB is the
  // practical ceiling for anything uploaded through a Server Action.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // Pages visited in the last 30 s open instantly from the client cache
    // (going back and forth between CRM, KPIs and Inicio) instead of
    // asking the server again every time.
    staleTimes: { dynamic: 30 },
  },
  // ffmpeg-static ships a native binary (voice-note conversion, see
  // lib/audioConvert.ts) — keep it out of the server bundle and make sure
  // Vercel's file tracer actually copies the binary into the deployment.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/ffmpeg-static/**/*"],
  },
  async headers() {
    return [
      {
        // Everything except the public pages under /sitio: those set their
        // own headers in the route (app/sitio/[slug]/route.ts), because a
        // page with a Meta Pixel / Google tag needs a per-response nonce in
        // its CSP (lib/siteTracking.ts) — and a header set here would
        // override the one the route returns.
        // /agenda-llamada (Funnels Labs' booking page) also sends its own,
        // since it talks to the booking Apps Script from the browser.
        source: "/:path((?!sitio/|agenda-llamada$).*)",
        headers: [...SECURITY_HEADERS, { key: "Content-Security-Policy", value: APP_CSP }],
      },
      {
        // The rest of /sitio (lead form, booking and click redirects) keeps
        // the strict site policy; the page route itself is excluded here.
        source: "/sitio/:slug/:rest+",
        headers: [...SECURITY_HEADERS, { key: "Content-Security-Policy", value: SITE_CSP }],
      },
      {
        // The creation studio's style previews: an example site page shown
        // in an iframe inside the dashboard, so it needs the site policy
        // (frameable by our own origin, no scripts), not the app's.
        source: "/dashboard/businesses/:id/website/muestra",
        headers: [{ key: "Content-Security-Policy", value: SITE_CSP }],
      },
    ];
  },
};

export default nextConfig;
