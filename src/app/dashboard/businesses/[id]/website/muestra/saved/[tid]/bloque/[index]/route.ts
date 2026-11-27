import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAgencyAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { HTML_BLOCK_HEADERS, htmlBlockFromContent } from "@/lib/htmlBlock";

// The HTML of a saved template, for its thumbnail in the library: members of the account that
// saved it, and the agency admin.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; tid: string; index: string }> }) {
  const { id, tid, index } = await params;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("No autorizado", { status: 401 });
  const membership = await prisma.membership.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: id } }, select: { userId: true } });
  if (!membership) return new NextResponse("No autorizado", { status: 403 });
  const tpl = await prisma.savedPageTemplate.findUnique({ where: { id: tid }, select: { businessId: true, content: true } });
  if (!tpl || (tpl.businessId !== id && !(await isAgencyAdmin(session.user.id)))) return new NextResponse("No encontrada", { status: 404 });
  const html = htmlBlockFromContent(tpl.content, Number(index));
  if (!html) return new NextResponse("No encontrada", { status: 404 });
  return new NextResponse(html, { headers: HTML_BLOCK_HEADERS });
}
