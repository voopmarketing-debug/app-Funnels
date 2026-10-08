import crypto from "node:crypto";

// Meta Pixel + Google tag on a client's public pages, so they can measure
// and optimize ad campaigns that point at them. Only validated ids are
// accepted (never free-form code); the snippets are fixed here and run
// under a per-response nonce, so the page CSP still blocks every other
// script.

export type SiteTracking = { metaPixelId: string | null; googleTagId: string | null };

/** Meta Pixel ids are numeric (typically 15–16 digits). */
export function cleanMetaPixelId(raw: unknown): string | null {
  const v = String(raw ?? "").replace(/\s/g, "");
  return /^\d{6,20}$/.test(v) ? v : null;
}

/** Google tag ids: GA4 (G-…), Google Ads (AW-…), or a Google tag (GT-…). */
export function cleanGoogleTagId(raw: unknown): string | null {
  const v = String(raw ?? "").replace(/\s/g, "").toUpperCase();
  return /^(G|AW|GT|DC)-[A-Z0-9]{4,20}$/.test(v) ? v : null;
}

export type SiteEvents = { lead?: boolean; schedule?: boolean };

function csp(nonce: string, t: SiteTracking): string {
  const scripts = [`'nonce-${nonce}'`];
  const connect = ["'self'"];
  const frames = ["https://www.youtube.com", "https://player.vimeo.com"];
  if (t.metaPixelId) {
    scripts.push("https://connect.facebook.net");
    connect.push("https://www.facebook.com", "https://connect.facebook.net");
  }
  if (t.googleTagId) {
    scripts.push("https://www.googletagmanager.com", "https://www.googleadservices.com", "https://googleads.g.doubleclick.net", "https://www.google.com");
    connect.push(
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
      "https://www.google.com",
      "https://*.doubleclick.net",
      "https://www.googleadservices.com",
    );
    frames.push("https://td.doubleclick.net", "https://www.googletagmanager.com");
  }
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `frame-src ${frames.join(" ")}`,
    `connect-src ${connect.join(" ")}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function snippet(nonce: string, t: SiteTracking, events: SiteEvents): string {
  const parts: string[] = [];
  if (t.googleTagId) {
    parts.push(`<script async nonce="${nonce}" src="https://www.googletagmanager.com/gtag/js?id=${t.googleTagId}"></script>`);
  }
  // Ids are validated (digits / [A-Z0-9-]) before reaching here, so they're
  // safe to place inside the script literal.
  const js = `(function(){
${
  t.metaPixelId
    ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${t.metaPixelId}');fbq('track','PageView');`
    : ""
}
${
  t.googleTagId
    ? `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${t.googleTagId}');`
    : ""
}
function track(fb,g){try{if(window.fbq)fbq('track',fb);if(window.gtag)gtag('event',g);}catch(e){}}
${events.lead ? "track('Lead','generate_lead');" : ""}
${events.schedule ? "track('Schedule','schedule_appointment');" : ""}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;var h=a.getAttribute('href')||'';if(/(^|\\/)ir\\?/.test(h)||/wa\\.me|whatsapp/i.test(h))track('Contact','contact');},true);
})();`;
  parts.push(`<script nonce="${nonce}">${js}</script>`);
  return parts.join("\n");
}

/**
 * Adds the client's tracking to a rendered public page and returns the
 * matching Content-Security-Policy. Untouched when the page has no ids, or
 * for the dashboard's preview (the owner's own visits aren't campaign data).
 */
export function withSiteTracking(
  html: string,
  headers: Record<string, string>,
  tracking: SiteTracking,
  opts: { preview?: boolean; events?: SiteEvents } = {},
): { html: string; headers: Record<string, string> } {
  if (opts.preview || (!tracking.metaPixelId && !tracking.googleTagId)) return { html, headers };
  const nonce = crypto.randomBytes(16).toString("base64");
  const tag = snippet(nonce, tracking, opts.events ?? {});
  const withTag = html.includes("</head>") ? html.replace("</head>", `${tag}\n</head>`) : `${tag}\n${html}`;
  return { html: withTag, headers: { ...headers, "Content-Security-Policy": csp(nonce, tracking) } };
}
