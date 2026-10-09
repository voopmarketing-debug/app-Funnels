import { renderAgencyAgendaPage } from "@/lib/agencyAgendaPage";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

// Funnels Labs' own booking page. Visitors reach it as
// agenda.funnelslabs.app/agenda: a routing rule on that Vercel project
// rewrites the path here (see lib/agencyAgendaPage.ts).

// The CRM endpoint lives on this app's own domain. In production that's
// fixed, since the page is served through the agenda domain's rewrite.
function appOrigin(req: Request): string {
  return process.env.VERCEL_ENV === "production" ? "https://agente.funnelslabs.app" : new URL(req.url).origin;
}

export function GET(req: Request) {
  const { html, csp } = renderAgencyAgendaPage({ crmUrl: `${appOrigin(req)}/api/agenda-llamada` });
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300", "Content-Security-Policy": csp });
  for (const h of SECURITY_HEADERS) headers.set(h.key, h.value);
  return new Response(html, { headers });
}
