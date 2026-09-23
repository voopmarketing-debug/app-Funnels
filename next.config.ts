import type { NextConfig } from "next";
import { SECURITY_HEADERS, SITE_CSP } from "./src/lib/securityHeaders";

// Baseline CSP for the authenticated app (dashboard, login, landing pages —
// real Next.js/React routes). 'unsafe-inline' on script-src is needed for
// Next's own hydration bootstrap scripts (no nonce middleware is wired up);
// it still blocks loading any *external* script, which is what actually
// matters here since there's no dangerouslySetInnerHTML anywhere in the
// dashboard (see the cyber-neo audit).
const APP_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const nextConfig: NextConfig = {
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
        source: "/:path*",
        headers: [...SECURITY_HEADERS, { key: "Content-Security-Policy", value: APP_CSP }],
      },
      {
        // Listed after the catch-all so its Content-Security-Policy value
        // wins for this more specific path (Next.js: later matching entries
        // override earlier ones for the same header key).
        source: "/sitio/:slug*",
        headers: [{ key: "Content-Security-Policy", value: SITE_CSP }],
      },
    ];
  },
};

export default nextConfig;
