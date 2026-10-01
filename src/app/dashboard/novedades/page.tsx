import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAgencyAdmin } from "@/lib/authz";
import { AnnouncementManager, type AdminAnnouncement } from "./AnnouncementManager";

// Agency-only: what every client sees in the banner and "Novedades" section
// of their Inicio page. Anyone else gets a 404, not a hint the page exists.
export default async function NovedadesAdminPage() {
  const session = await auth();
  if (!session?.user?.id || !(await isAgencyAdmin(session.user.id))) notFound();

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });

  const items: AdminAnnouncement[] = announcements.map((a) => ({
    id: a.id,
    kind: a.kind === "BANNER" ? "BANNER" : "NEWS",
    title: a.title,
    body: a.body,
    badge: a.badge,
    imageUrl: a.imageUrl,
    ctaLabel: a.ctaLabel,
    ctaUrl: a.ctaUrl,
    published: a.published,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Novedades de la plataforma</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Lo que publiques aquí aparece en la página de <strong className="text-ink">Inicio</strong> de todos tus clientes.
          El <strong className="text-ink">banner</strong> es el anuncio grande de arriba (se muestra el primero publicado);
          las <strong className="text-ink">novedades</strong> forman la lista de actualizaciones.
        </p>
      </div>
      <AnnouncementManager items={items} />
    </div>
  );
}
