import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogProducts } from "@/lib/websiteRender";
import { renderWebsiteHtmlV2 } from "@/lib/websiteTemplateV2";
import { getWebsiteHeroContext } from "@/lib/websiteHero";
import { buildSampleContent, sampleProducts } from "@/lib/websiteSample";
import { PAGE_TYPES, STYLE_KEYS, type PageType, type StyleKey } from "@/lib/websiteContentV2";
import { siteSecurityHeaders } from "@/lib/securityHeaders";

// The creation studio's style previews (thumbnails and the big preview):
// an example page in the requested style and page type, with this
// business's own name, products and photos, rendered by the real site
// renderer. Members only — it shows the business's catalog.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("No autorizado", { status: 401 });
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    select: { business: { select: { name: true, industry: true } } },
  });
  if (!membership) return new NextResponse("No autorizado", { status: 403 });

  const styleParam = req.nextUrl.searchParams.get("style");
  const typeParam = req.nextUrl.searchParams.get("type");
  const style: StyleKey = STYLE_KEYS.includes(styleParam as StyleKey) ? (styleParam as StyleKey) : "editorial";
  const pageType: PageType = PAGE_TYPES.includes(typeParam as PageType) ? (typeParam as PageType) : "servicios";

  const [realProducts, photos, hero] = await Promise.all([
    getCatalogProducts(id),
    prisma.agentMedia.findMany({
      where: { businessId: id, mediaType: "image" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { url: true },
    }),
    getWebsiteHeroContext(id, membership.business.industry, null),
  ]);
  const products = sampleProducts(realProducts);

  const content = buildSampleContent({ pageType, style, businessName: membership.business.name, products });
  // The owner's brand color, while picking it in the studio.
  const color = req.nextUrl.searchParams.get("color");
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) content.theme = { ...content.theme, primaryColor: color };

  const html = renderWebsiteHtmlV2(content, {
    businessName: membership.business.name,
    // Links stay on the page: this is a picture of the design, not a site.
    trackingBasePath: "#",
    preview: true,
    heroImageUrl: hero.heroImageUrl,
    photos: photos.map((p) => p.url),
    products,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      ...siteSecurityHeaders(),
    },
  });
}
