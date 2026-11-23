import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogProducts, getShowcaseProducts } from "@/lib/websiteRender";
import { templateForPageType } from "@/lib/templateSite/content";
import { renderTemplateSite } from "@/lib/templateSite/render";
import { buildSampleTemplate } from "@/lib/templateSite/sample";
import { withSiteTracking } from "@/lib/siteTracking";
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

  // Showroom and Scroll Story are fixed templates: the preview is the real template with
  // this business's own products and photos (when it has none yet, the generic sample below).
  const template = templateForPageType(pageType);
  if (template) {
    const showcase = await getShowcaseProducts(id);
    if (showcase.some((p) => p.imageUrl)) {
      const color = req.nextUrl.searchParams.get("color");
      const content = buildSampleTemplate(template, membership.business.name, color);
      const html = renderTemplateSite(content, { businessName: membership.business.name, trackingBasePath: "#", preview: true, products: showcase });
      const tracked = withSiteTracking(
        html,
        { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=300", ...siteSecurityHeaders() },
        { metaPixelId: null, googleTagId: null },
        { preview: true },
      );
      return new NextResponse(tracked.html, { headers: tracked.headers });
    }
  }

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
