import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { WebsiteEditor } from "./WebsiteEditor";
import { RegenerateOldPageButton } from "./RegenerateOldPageButton";

export default async function WebsiteEditorPage({
  params,
}: {
  params: Promise<{ id: string; websiteId: string }>;
}) {
  const { id, websiteId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true } } },
  });
  if (!membership) notFound();

  const website = await prisma.website.findFirst({ where: { id: websiteId, businessId: id } });
  if (!website) notFound();

  const parsedContent = WebsiteContentSchema.safeParse(website.content);
  const appHost = process.env.APP_HOST ?? "agente.funnelslabs.app";

  if (!parsedContent.success) {
    return (
      <div className="space-y-6">
        <Link href={`/dashboard/businesses/${id}/website`} className="text-sm text-ink-muted underline hover:text-ink">
          ← Sitios web
        </Link>
        <div className="fl-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-ink">Esta página se generó con una versión anterior del sistema</p>
          <p className="text-xs text-ink-muted">
            Necesita regenerarse una vez para poder editarla — el contenido actual no se perderá hasta que lo hagas.
          </p>
          <RegenerateOldPageButton businessId={id} websiteId={websiteId} />
        </div>
      </div>
    );
  }

  const [totalViews, clicksWhatsapp, clicksAgenda, leads] = await Promise.all([
    prisma.websiteEvent.count({ where: { websiteId, type: "view" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "whatsapp" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "agenda" } }),
    prisma.websiteLead.findMany({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, contact: true, message: true, createdAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/businesses/${id}/website`}
          className="text-sm text-ink-muted underline hover:text-ink"
        >
          ← Sitios web
        </Link>
        <h1 className="mt-1 text-xl font-bold">{website.name}</h1>
        {website.purpose && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{website.purpose}</p>}
      </div>

      <WebsiteEditor
        businessId={id}
        websiteId={websiteId}
        content={parsedContent.data}
        customDomain={website.customDomain}
        generatedAt={website.generatedAt}
        publicUrl={`https://${appHost}/sitio/${website.slug}`}
        stats={{ totalViews, clicksWhatsapp, clicksAgenda }}
        leads={leads}
      />
    </div>
  );
}
