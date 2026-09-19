import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteManager } from "./WebsiteManager";

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaPhoneNumberId: true } } },
  });
  if (!membership) notFound();

  const website = await prisma.website.findUnique({ where: { businessId: id } });
  const appHost = process.env.APP_HOST ?? "funnelslabs.app";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Sitio web</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Claude arma una página completa para este negocio, adaptada a su rubro, con el WhatsApp del negocio como
          botón principal — todo lo que llega por ahí cae directo en el CRM de arriba.
        </p>
      </div>

      <WebsiteManager
        businessId={id}
        hasWabaCredentials={!!membership.business.wabaPhoneNumberId}
        website={website ? { slug: website.slug, generatedAt: website.generatedAt } : null}
        publicUrlBase={`https://${appHost}/sitio`}
      />
    </div>
  );
}
