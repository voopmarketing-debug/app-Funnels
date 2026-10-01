import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// One link that works for every client (used by announcements/banners):
// sends each person straight to the "Crear con IA" studio of their own
// business — the one they own, or else the first they have access to.
export default async function CreatePageShortcut() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership =
    (await prisma.membership.findFirst({
      where: { userId: session.user.id, role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { businessId: true },
    })) ??
    (await prisma.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { businessId: true },
    }));

  if (!membership) redirect("/dashboard/agentes");
  redirect(`/dashboard/businesses/${membership.businessId}/website/crear`);
}
