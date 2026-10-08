import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

// Wraps every page scoped to one business (CRM, sitio web, analítica,
// plantillas, conversaciones, la página del negocio en sí) — one place to
// block access once a business's paid period has lapsed, instead of
// repeating the check in each page. The agency's own membership (role
// ADMIN on this business) always gets through, since they're the ones who
// need to follow up on payment and manage the account either way.
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, subscriptionEndsAt: true } } },
  });
  if (!membership) notFound();

  const blocked = membership.role !== "ADMIN" && !isSubscriptionActive(membership.business.subscriptionEndsAt);
  if (!blocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className="fl-card space-y-3 p-8">
        <h1 className="text-lg font-bold text-ink">Suscripción vencida</h1>
        <p className="text-sm text-ink-muted">
          El acceso de <strong>{membership.business.name}</strong> a Funnels Labs está pausado porque su período
          pagado venció, y tu agente dejó de responder por ahora.
        </p>
        <p className="text-sm text-ink-muted">
          <strong className="text-ink">No se borró nada:</strong> tus contactos, conversaciones, embudos, páginas y la
          configuración de tu agente siguen guardados. Apenas renueves, todo vuelve tal cual estaba.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Renovar por WhatsApp
          </a>
          <Link
            href="/dashboard"
            className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
