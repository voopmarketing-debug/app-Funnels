import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureWebsiteLead } from "@/lib/websiteLeads";

// Handles the lead-capture form's POST (see lib/websiteTemplate.ts's
// .lead-form) — saves a WebsiteLead, then redirects back to the page so a
// refresh doesn't resubmit the form.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const website = await prisma.website.findUnique({ where: { slug }, select: { id: true } });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
  }

  const formData = await req.formData();
  const ok = await captureWebsiteLead(website.id, formData);

  const url = new URL(`/sitio/${slug}`, req.url);
  if (ok) url.searchParams.set("registrado", "1");
  return NextResponse.redirect(url, { status: 303 });
}
