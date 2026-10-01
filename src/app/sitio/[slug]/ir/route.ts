import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveClickTarget } from "@/lib/websiteRender";

// Every CTA button on a generated page routes through here instead of
// linking straight to WhatsApp/the agenda link — logs a click, then
// redirects. The real destination is always resolved server-side from the
// page's own stored content (never a client-supplied URL), so this can't
// be used as an open redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = req.nextUrl.searchParams.get("label") ?? "unknown";
  // See the matching comment in ../route.ts — set only when this click came
  // from the dashboard's own "Vista previa" iframe, not a real visitor.
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const website = await prisma.website.findUnique({
    where: { slug },
    select: { id: true, content: true, whatsappNumber: true, businessId: true },
  });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
  }

  // ?p=<productId>: "Pedir por WhatsApp" on a product card — opens the
  // chat with the order already written.
  const { target, destination } = await resolveClickTarget(website, req.nextUrl.searchParams.get("p"));

  if (!preview) {
    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "cta_click", label, destination } });
    } catch (err) {
      console.error("Failed to log website click event:", err);
    }
  }

  return NextResponse.redirect(target, { status: 302 });
}
