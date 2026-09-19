import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { WebsiteEditor } from "./WebsiteEditor";

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
  if (!parsedContent.success) notFound();

  const appHost = process.env.APP_HOST ?? "funnelslabs.app";

  const [totalViews, clicksWhatsapp, clicksAgenda] = await Promise.all([
    prisma.websiteEvent.count({ where: { websiteId, type: "view" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "whatsapp" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "agenda" } }),
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
      />
    </div>
  );
}
