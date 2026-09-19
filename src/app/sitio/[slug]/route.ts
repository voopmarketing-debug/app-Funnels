import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";

// Publicly serves one business page — no auth, meant to be shared/indexed
// like any regular website. Rendered fresh from the structured content on
// every request (see lib/websiteTemplate.ts), so an edit in the dashboard
// is live immediately — no separate "publish" step, no stale cached HTML.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const website = await prisma.website.findUnique({
    where: { slug },
    select: { id: true, content: true, whatsappNumber: true, business: { select: { name: true } } },
  });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
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
    trackingBasePath: `/sitio/${slug}`,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
