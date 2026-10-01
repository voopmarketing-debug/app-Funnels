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
    include: { business: { select: { name: true, wabaAccessToken: true, wabaPhoneNumberId: true } } },
  });
  if (!membership) notFound();
  const [productCount, owner] = await Promise.all([
    prisma.product.count({ where: { businessId: id, active: true } }),
    prisma.membership.findFirst({ where: { businessId: id, role: "OWNER" }, select: { user: { select: { phone: true } } } }),
  ]);
  // Every button on the page leads to WhatsApp: without a connected line or
  // a phone on the owner's profile, the studio asks for the number up front
  // instead of failing at the very end.
  const hasWhatsapp = !!(membership.business.wabaAccessToken && membership.business.wabaPhoneNumberId) || !!owner?.user.phone?.trim();
  return <CreationStudio businessId={id} businessName={membership.business.name} productCount={productCount} needsWhatsapp={!hasWhatsapp} />;
}
