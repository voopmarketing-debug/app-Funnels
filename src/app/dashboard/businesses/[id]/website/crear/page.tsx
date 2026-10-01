import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreationStudio } from "./CreationStudio";

export default async function CreateWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaAccessToken: true, wabaPhoneNumberId: true, brandPrimaryColor: true, brandSecondaryColor: true } } },
  });
  if (!membership) notFound();
  const [productCount, owner, latestPage] = await Promise.all([
    prisma.product.count({ where: { businessId: id, active: true } }),
    prisma.membership.findFirst({ where: { businessId: id, role: "OWNER" }, select: { user: { select: { phone: true } } } }),
    prisma.website.findFirst({ where: { businessId: id, pageType: "landing" }, orderBy: { generatedAt: "desc" }, select: { content: true } }),
  ]);
  // Brand colors saved before, or the accent of the latest page.
  const pageContent = latestPage?.content as { theme?: { primaryColor?: unknown }; primaryColor?: unknown } | null;
  const pagePrimary = pageContent?.theme?.primaryColor ?? pageContent?.primaryColor;
  const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const brandPrimary = isHex(membership.business.brandPrimaryColor) ? membership.business.brandPrimaryColor : isHex(pagePrimary) ? pagePrimary : null;
  const brandSecondary = isHex(membership.business.brandSecondaryColor) ? membership.business.brandSecondaryColor : null;
  // Every button on the page leads to WhatsApp: without a connected line or
  // a phone on the owner's profile, the studio asks for the number up front
  // instead of failing at the very end.
  const hasWhatsapp = !!(membership.business.wabaAccessToken && membership.business.wabaPhoneNumberId) || !!owner?.user.phone?.trim();
  return (
    <CreationStudio
      businessId={id}
      businessName={membership.business.name}
      productCount={productCount}
      needsWhatsapp={!hasWhatsapp}
      initialBrand={{ primary: brandPrimary, secondary: brandSecondary }}
    />
  );
}
