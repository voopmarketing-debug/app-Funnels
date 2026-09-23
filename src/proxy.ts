import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";
import { captureWebsiteLead } from "@/lib/websiteLeads";
import { customDomainSecurityHeaders } from "@/lib/securityHeaders";

// Hosts this app already answers for on purpose — everything else that
// reaches this deployment has been manually connected in Vercel as a
// client's own domain or a dedicated FunnelsLabs subdomain (e.g.
// clinica-sonrisa.funnelslabs.app) for one specific generated page (see
// Website.customDomain, set from the "Dominio propio" field in the website
// editor). No code change or redeploy is needed to connect a new one —
// once the domain points here and its DB row has this hostname saved, this
// proxy starts serving it automatically.
const APP_HOSTS = new Set(["agente.funnelslabs.app", "localhost:3000", "localhost"]);

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();

  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname) || hostname.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const website = await prisma.website.findUnique({
    where: { customDomain: hostname },
    select: { id: true, content: true, whatsappNumber: true, business: { select: { name: true } } },
  });

  if (!website) {
    // Unknown host with nothing connected — fall through to normal routing
    // (will 404 through the app like any unmatched request).
    return NextResponse.next();
  }

  const parsedContent = WebsiteContentSchema.safeParse(website.content);
  if (!parsedContent.success) {
    // Content saved under an earlier version of the schema — ask the
    // owner to regenerate rather than showing a raw error to visitors.
    return new NextResponse(
      "Esta página necesita actualizarse — pide al dueño del negocio que entre a su panel y le dé 'Regenerar todo con IA'.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...customDomainSecurityHeaders() } },
    );
  }
  const content = parsedContent.data;

  // Same lead-capture form POST as /sitio/[slug]/registro, reached here as
  // a root-relative "/registro" action since a custom domain has no slug.
  if (request.nextUrl.pathname === "/registro" && request.method === "POST") {
    const formData = await request.formData();
    const ok = await captureWebsiteLead(website.id, formData);
    const url = new URL("/", request.url);
    if (ok) url.searchParams.set("registrado", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  // Same click-through redirect as /sitio/[slug]/ir, reached here as a
  // root-relative "/ir" link since a custom domain has no slug in its path.
  if (request.nextUrl.pathname === "/ir") {
    const label = request.nextUrl.searchParams.get("label") ?? "unknown";
    const destination = content.hero.ctaUrl ? "agenda" : "whatsapp";
    const target = content.hero.ctaUrl || `https://wa.me/${website.whatsappNumber.replace(/[^0-9]/g, "")}`;

    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "cta_click", label, destination } });
    } catch (err) {
      console.error("Failed to log website click event:", err);
    }

    return NextResponse.redirect(target, { status: 302 });
  }

  try {
    await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "view" } });
  } catch (err) {
    console.error("Failed to log website view event:", err);
  }

  const html = renderWebsiteHtml(content, {
    businessName: website.business.name,
    whatsappNumber: website.whatsappNumber,
    trackingBasePath: "",
    leadSubmitted: request.nextUrl.searchParams.get("registrado") === "1",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...customDomainSecurityHeaders() },
  });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
