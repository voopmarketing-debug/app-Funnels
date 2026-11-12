import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/subscription";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { renewalContext } from "@/lib/renewal";
import { RenewButtons } from "./RenewButtons";

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

  // Only the account's owner can pay; a salesperson is told who to ask.
  const renewal = membership.role === "OWNER" ? await renewalContext(session.user.id) : null;

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="fl-card space-y-5 p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">Tu plan venció</h1>
          <p className="text-sm text-ink-muted">
            {renewal
              ? "Tu agente dejó de responder. Renueva y vuelve a atender al instante: tus datos siguen aquí."
              : `El agente de ${membership.business.name} está pausado. Avísale al dueño de la cuenta para que renueve.`}
          </p>
        </div>
        {renewal ? (
          <RenewButtons
            priceLabel={`$${new Intl.NumberFormat("es-CO").format(renewal.priceCop)} COP/mes`}
            supportLink={SUPPORT_WHATSAPP_LINK}
          />
        ) : (
          <a
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Hablar con soporte
          </a>
        )}
        <Link href="/dashboard" className="block text-xs text-ink-muted underline hover:text-ink">
          Volver
        </Link>
      </div>
    </div>
  );
}
