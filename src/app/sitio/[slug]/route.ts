import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";
import { getWebsiteHeroContext } from "@/lib/websiteHero";
import { siteSecurityHeaders } from "@/lib/securityHeaders";

// Publicly serves one business page — no auth, meant to be shared/indexed
// like any regular website. Rendered fresh from the structured content on
// every request (see lib/websiteTemplate.ts), so an edit in the dashboard
// is live immediately — no separate "publish" step, no stale cached HTML.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const leadSubmitted = req.nextUrl.searchParams.get("registrado") === "1";
  // Set only by the dashboard's own "Vista previa" iframe (see
  // WebsiteEditor.tsx) — the owner opening their editor, or saving a
  // change and triggering a preview reload, isn't a real visitor and
  // shouldn't inflate their own view count.
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const website = await prisma.website.findUnique({
    where: { slug },
    select: {
      id: true,
      content: true,
      whatsappNumber: true,
      businessId: true,
      business: { select: { name: true, industry: true } },
    },
  });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404, headers: siteSecurityHeaders() });
  }

  if (!preview) {
    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "view" } });
    } catch (err) {
      console.error("Failed to log website view event:", err);
    }
  }

  const parsedContent = WebsiteContentSchema.safeParse(website.content);
  if (!parsedContent.success) {
    // Content saved under an earlier version of the schema — ask the
    // owner to regenerate rather than showing a raw 500 to visitors.
    return new NextResponse(
      "Esta página necesita actualizarse — pide al dueño del negocio que entre a su panel y le dé 'Regenerar todo con IA'.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...siteSecurityHeaders() } },
    );
  }

  const { eyebrow, heroImageUrl } = await getWebsiteHeroContext(website.businessId, website.business.industry);

  const html = renderWebsiteHtml(parsedContent.data, {
    businessName: website.business.name,
    whatsappNumber: website.whatsappNumber,
    trackingBasePath: `/sitio/${slug}`,
    leadSubmitted,
    preview,
    eyebrow,
    heroImageUrl,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...siteSecurityHeaders() },
  });
}
