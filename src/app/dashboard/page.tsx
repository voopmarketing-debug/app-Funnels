import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { business: { include: { agent: true, _count: { select: { conversations: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Negocios</h1>
        <Link
          href="/dashboard/businesses/new"
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          + Nuevo negocio
        </Link>
      </div>

      {memberships.length === 0 && (
        <p className="text-ink-muted">
          Todavía no hay negocios. Crea el primero para conectar su WhatsApp.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map(({ business }) => (
          <li key={business.id}>
            <Link
              href={`/dashboard/businesses/${business.id}`}
              className="block rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong"
            >
              <p className="font-medium">{business.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${business.agent?.enabled ? "bg-accent" : "bg-ink-faint"}`}
                />
                Agente {business.agent?.enabled ? "activo" : "inactivo"}
              </p>
              <p className="text-sm text-ink-muted">
                {business._count.conversations} conversaciones
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
