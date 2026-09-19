import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";

// Every CTA button on a generated page routes through here instead of
// linking straight to WhatsApp/the agenda link — logs a click, then
// redirects. The real destination is always resolved server-side from the
// page's own stored content (never a client-supplied URL), so this can't
// be used as an open redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = req.nextUrl.searchParams.get("label") ?? "unknown";

  const website = await prisma.website.findUnique({
    where: { slug },
    select: { id: true, content: true, whatsappNumber: true },
  });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
  }

  const content = WebsiteContentSchema.parse(website.content);
  const target = content.hero.ctaUrl || `https://wa.me/${website.whatsappNumber.replace(/[^0-9]/g, "")}`;

  try {
    await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "cta_click", label } });
  } catch (err) {
    console.error("Failed to log website click event:", err);
  }

  return NextResponse.redirect(target, { status: 302 });
}
