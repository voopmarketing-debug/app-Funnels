import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";

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

  // Same click-through redirect as /sitio/[slug]/ir, reached here as a
  // root-relative "/ir" link since a custom domain has no slug in its path.
  if (request.nextUrl.pathname === "/ir") {
    const label = request.nextUrl.searchParams.get("label") ?? "unknown";
    const content = WebsiteContentSchema.parse(website.content);
    const target = content.hero.ctaUrl || `https://wa.me/${website.whatsappNumber.replace(/[^0-9]/g, "")}`;

    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "cta_click", label } });
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

  const content = WebsiteContentSchema.parse(website.content);
  const html = renderWebsiteHtml(content, {
    businessName: website.business.name,
    whatsappNumber: website.whatsappNumber,
    trackingBasePath: "",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
