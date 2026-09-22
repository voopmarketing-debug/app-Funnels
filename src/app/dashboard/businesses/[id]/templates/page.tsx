import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TemplateManager } from "./TemplateManager";

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaId: true } } },
  });
  if (!membership) notFound();

  const templateRows = await prisma.messageTemplate.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
  });
  const templates = templateRows.map((t) => ({
    ...t,
    buttons: Array.isArray(t.buttons) ? (t.buttons as { type: "URL"; text: string; url: string }[]) : [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Plantillas de mensaje</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Meta solo permite mandar mensajes libres a quien te escribió en las últimas 24 horas. Para llegarle a todo
          el pipeline en una difusión (incluyendo contactos "fríos"), el mensaje tiene que ser una plantilla
          aprobada por Meta — la aprobación puede tardar desde minutos hasta 1-2 días, y no depende de nosotros.
        </p>
      </div>

      <TemplateManager businessId={id} templates={templates} hasWabaId={!!membership.business.wabaId} />
    </div>
  );
}
