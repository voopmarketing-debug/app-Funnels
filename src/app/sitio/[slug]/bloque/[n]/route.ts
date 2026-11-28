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

  // The builder asks for the editing frame (?edit=1): only a member of the business gets it, published or not.
  const wantsEdit = req.nextUrl.searchParams.get("edit") === "1";
  let isMember = false;
  if (!website.published || wantsEdit) {
    const session = await auth();
    isMember = session?.user?.id
      ? !!(await prisma.membership.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: website.businessId } }, select: { id: true } }))
      : false;
    if (!website.published && !isMember) return NOT_FOUND();
  }

  const doc = htmlBlockFromContent(website.content, index, wantsEdit && isMember);
  if (!doc) return NOT_FOUND();
  return new NextResponse(doc, { headers: HTML_BLOCK_HEADERS });
}
