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
        <h1 className="text-xl font-semibold">Negocios</h1>
        <Link
          href="/dashboard/businesses/new"
          className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Nuevo negocio
        </Link>
      </div>

      {memberships.length === 0 && (
        <p className="text-black/60 dark:text-white/60">
          Todavía no hay negocios. Crea el primero para conectar su WhatsApp.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map(({ business }) => (
          <li key={business.id}>
            <Link
              href={`/dashboard/businesses/${business.id}`}
              className="block rounded-xl border border-black/10 p-4 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
            >
              <p className="font-medium">{business.name}</p>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Agente: {business.agent?.enabled ? "activo" : "inactivo"}
              </p>
              <p className="text-sm text-black/60 dark:text-white/60">
                {business._count.conversations} conversaciones
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
