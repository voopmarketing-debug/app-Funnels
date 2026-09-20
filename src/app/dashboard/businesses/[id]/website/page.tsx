import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsitePagesList } from "./WebsitePagesList";

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaPhoneNumberId: true } } },
  });
  if (!membership) notFound();

  const [websites, totalViews, totalClicksWhatsapp, totalClicksAgenda, totalLeads] = await Promise.all([
    prisma.website.findMany({
      where: { businessId: id },
      orderBy: { generatedAt: "asc" },
      select: {
        id: true,
        name: true,
        purpose: true,
        slug: true,
        generatedAt: true,
        customDomain: true,
        _count: { select: { events: { where: { type: "view" } }, leads: true } },
      },
    }),
    prisma.websiteEvent.count({ where: { type: "view", website: { businessId: id } } }),
    prisma.websiteEvent.count({ where: { type: "cta_click", destination: "whatsapp", website: { businessId: id } } }),
    prisma.websiteEvent.count({ where: { type: "cta_click", destination: "agenda", website: { businessId: id } } }),
    prisma.websiteLead.count({ where: { website: { businessId: id } } }),
  ]);
  const pages = websites.map((w) => ({ ...w, viewCount: w._count.events, leadCount: w._count.leads }));
  const appHost = process.env.APP_HOST ?? "funnelslabs.app";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Sitios web</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Crea con IA todas las páginas que necesites para este negocio — un sitio principal, una página para
          agendar una demo, o lo que haga falta — cada una con su propio link, y editable después: textos, colores,
          fuentes y video.
        </p>
      </div>

      <WebsitePagesList
        businessId={id}
        hasWabaCredentials={!!membership.business.wabaPhoneNumberId}
        pages={pages}
        publicUrlBase={`https://${appHost}/sitio`}
        stats={{ totalViews, totalClicksWhatsapp, totalClicksAgenda, totalLeads }}
      />
    </div>
  );
}
