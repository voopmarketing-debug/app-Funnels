import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LABELS } from "@/lib/plans";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { SubscriptionDatesEditor } from "./SubscriptionDatesEditor";
import { CreateClientForm } from "./CreateClientForm";

const EXPIRING_SOON_DAYS = 7;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function subscriptionStatus(endsAt: Date | null): "active" | "expiring" | "expired" | "unset" {
  if (!endsAt) return "unset";
  const daysLeft = (endsAt.getTime() - Date.now()) / 86_400_000;
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring";
  return "active";
}

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const adminMemberships = await prisma.membership.findMany({
    where: { userId: session.user.id, role: "ADMIN" },
    select: { businessId: true },
  });
  if (adminMemberships.length === 0) notFound();

  const businessIds = adminMemberships.map((m) => m.businessId);

  const owners = await prisma.membership.findMany({
    where: { businessId: { in: businessIds }, role: "OWNER" },
    include: { user: true, business: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Clientes</h1>
          <p className="text-sm text-ink-muted">
            Datos personales que cada cliente registró al crear su cuenta — úsalos para contactarlo o
            para entrar a probar su cuenta con sus credenciales si lo necesita.
          </p>
        </div>
        <CreateClientForm />
      </div>

      {owners.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay clientes registrados.</p>
      ) : (
        <div className="fl-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Membresía (inicio → vence)</th>
                <th className="px-4 py-3 font-medium">Registrado</th>
                <th className="px-4 py-3 font-medium">Contraseña</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(({ user, business, createdAt }) => (
                <tr key={business.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink">{user.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{user.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/businesses/${business.id}`} className="text-accent hover:underline">
                      {business.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{PLAN_LABELS[business.planTier]}</td>
                  <td className="px-4 py-3">
                    <SubscriptionDatesEditor
                      businessId={business.id}
                      startedAt={business.subscriptionStartedAt}
                      endsAt={business.subscriptionEndsAt}
                      status={subscriptionStatus(business.subscriptionEndsAt)}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(createdAt)}</td>
                  <td className="px-4 py-3">
                    <ResetPasswordButton userId={user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
