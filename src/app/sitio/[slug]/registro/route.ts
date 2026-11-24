import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureWebsiteLead } from "@/lib/websiteLeads";
import { publicFormBlock } from "@/lib/abuseGuard";
import { thankYouTarget } from "@/lib/sitePublish";

// Handles the lead-capture form's POST (see lib/websiteTemplate.ts's
// .lead-form) — saves a WebsiteLead, then redirects back to the page so a
// refresh doesn't resubmit the form.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // See the matching comment in ../route.ts — set only when this form
  // submission came from the dashboard's own "Vista previa" iframe, not a
  // real visitor, so testing the form doesn't create a fake lead.
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const website = await prisma.website.findUnique({ where: { slug }, select: { id: true, published: true, content: true } });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
  }
  // A draft takes no contacts from visitors.
  if (!website.published && !preview) return new NextResponse("Sitio no encontrado", { status: 404 });

  const formData = await req.formData();
  // A bot (hidden field filled) sees the usual "gracias" but nothing is
  // saved; past the per-IP limit, nothing is saved either.
  const block = preview ? null : await publicFormBlock(formData, req.headers, website.id, "lead");
  const ok = preview || block === "bot" ? true : block === "limited" ? false : await captureWebsiteLead(website.id, formData);

  // The owner's own thank-you page, once the contact was really taken (never from the builder's preview).
  const thanks = ok && !preview ? thankYouTarget(website.content) : null;
  if (thanks) return NextResponse.redirect(thanks, { status: 303 });

  const url = new URL(`/sitio/${slug}`, req.url);
  if (ok) url.searchParams.set("registrado", "1");
  return NextResponse.redirect(url, { status: 303 });
}
