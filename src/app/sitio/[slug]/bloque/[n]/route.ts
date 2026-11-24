import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HTML_BLOCK_HEADERS, htmlBlockFromContent } from "@/lib/htmlBlock";

// The frame of a "Código HTML" block (see lib/htmlBlock.ts). The code comes only from the page's
// stored content, by block number; the response carries a sandbox policy, so even opened directly
// the code runs without access to the platform.
const NOT_FOUND = () => new NextResponse("No encontrado", { status: 404, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const index = /^\d{1,2}$/.test(n) ? Number(n) : -1;
  if (index < 0) return NOT_FOUND();

  const website = await prisma.website.findUnique({ where: { slug }, select: { published: true, content: true, businessId: true } });
  if (!website) return NOT_FOUND();

  if (!website.published) {
    const session = await auth();
    const member = session?.user?.id
      ? await prisma.membership.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: website.businessId } }, select: { id: true } })
      : null;
    if (!member) return NOT_FOUND();
  }

  const doc = htmlBlockFromContent(website.content, index);
  if (!doc) return NOT_FOUND();
  return new NextResponse(doc, { headers: HTML_BLOCK_HEADERS });
}
