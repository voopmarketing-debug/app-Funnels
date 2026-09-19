import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Publicly serves a business's Claude-generated marketing site — no auth,
// this is meant to be shared/indexed like any regular website. The stored
// `html` is a complete, self-contained document (see lib/websiteGenerator.ts).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const website = await prisma.website.findUnique({ where: { slug }, select: { html: true } });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404 });
  }

  return new NextResponse(website.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
