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
    include: { business: { select: { name: true } } },
  });
  if (!membership) notFound();
  const productCount = await prisma.product.count({ where: { businessId: id, active: true } });
  return <CreationStudio businessId={id} businessName={membership.business.name} productCount={productCount} />;
}
