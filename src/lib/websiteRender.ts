import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";
import { renderWebsiteHtmlV2 } from "@/lib/websiteTemplateV2";
import { WebsiteContentV2Schema, formatMoney, isV2Content, type CatalogProduct, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { getWebsiteHeroContext } from "@/lib/websiteHero";

type StoredWebsite = {
  content: unknown;
  whatsappNumber: string;
  businessId: string;
  aiImageUrl: string | null;
  business: { name: string; industry: string };
};

export async function getCatalogProducts(businessId: string): Promise<CatalogProduct[]> {
  return prisma.product.findMany({
    where: { businessId, active: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, description: true, price: true, compareAtPrice: true, currency: true, category: true, imageUrl: true, badge: true },
  });
}

/**
 * Renders a landing page (v1 or v2 content) to HTML — shared by
 * /sitio/[slug] and custom domains (proxy.ts). Null when the stored content
 * doesn't match either schema.
 */
export async function renderStoredWebsite(
  website: StoredWebsite,
  opts: {
    trackingBasePath: string;
    leadSubmitted?: boolean;
    preview?: boolean;
    // Unsaved colors/fonts from the builder's Diseño tab, shown live in the
    // preview iframe before the owner applies them (v2 pages only).
    themeOverride?: Partial<WebsiteContentV2["theme"]>;
  },
): Promise<string | null> {
  const { eyebrow, heroImageUrl } = await getWebsiteHeroContext(website.businessId, website.business.industry, website.aiImageUrl);

  if (isV2Content(website.content)) {
    const parsed = WebsiteContentV2Schema.safeParse(website.content);
    if (!parsed.success) return null;
    const [products, photos] = await Promise.all([
      getCatalogProducts(website.businessId),
      prisma.agentMedia.findMany({
        where: { businessId: website.businessId, mediaType: "image" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { url: true },
      }),
    ]);
    const content = opts.themeOverride ? { ...parsed.data, theme: { ...parsed.data.theme, ...opts.themeOverride } } : parsed.data;
    return renderWebsiteHtmlV2(content, {
      businessName: website.business.name,
      trackingBasePath: opts.trackingBasePath,
      preview: opts.preview,
      leadSubmitted: opts.leadSubmitted,
      heroImageUrl: website.aiImageUrl ?? heroImageUrl,
      photos: photos.map((p) => p.url),
      products,
    });
  }

  const parsed = WebsiteContentSchema.safeParse(website.content);
  if (!parsed.success) return null;
  return renderWebsiteHtml(parsed.data, {
    businessName: website.business.name,
    whatsappNumber: website.whatsappNumber,
    trackingBasePath: opts.trackingBasePath,
    leadSubmitted: opts.leadSubmitted,
    preview: opts.preview,
    eyebrow,
    heroImageUrl,
  });
}

/**
 * Where a tracked click (/ir) goes. Always resolved server-side from the
 * stored page and catalog — never from a client-supplied URL — so /ir
 * can't be used as an open redirect. A product order opens WhatsApp with
 * the order already written.
 */
export async function resolveClickTarget(
  website: { content: unknown; whatsappNumber: string; businessId: string },
  productId: string | null,
): Promise<{ target: string; destination: "whatsapp" | "agenda" }> {
  const wa = `https://wa.me/${website.whatsappNumber.replace(/[^0-9]/g, "")}`;

  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: website.businessId, active: true },
      select: { name: true, price: true, currency: true },
    });
    if (product) {
      const price = product.price !== null ? ` (${formatMoney(product.price, product.currency)})` : "";
      const text = `Hola, quiero pedir: ${product.name}${price}`;
      return { target: `${wa}?text=${encodeURIComponent(text)}`, destination: "whatsapp" };
    }
  }

  let ctaUrl: string | null = null;
  if (isV2Content(website.content)) {
    const parsed = WebsiteContentV2Schema.safeParse(website.content);
    ctaUrl = parsed.success ? parsed.data.heroCtaUrl : null;
  } else {
    const parsed = WebsiteContentSchema.safeParse(website.content);
    ctaUrl = parsed.success ? parsed.data.hero.ctaUrl : null;
  }
  return ctaUrl ? { target: ctaUrl, destination: "agenda" } : { target: wa, destination: "whatsapp" };
}
