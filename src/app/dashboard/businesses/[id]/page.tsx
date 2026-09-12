import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateAgent } from "@/lib/actions";

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { include: { agent: true } } },
  });

  if (!membership) notFound();
  const { business } = membership;

  const conversations = await prisma.conversation.findMany({
    where: { businessId: id },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  const boundUpdateAgent = updateAgent.bind(null, id);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">{business.name}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          WhatsApp: {business.wabaPhoneNumberId}
        </p>

        <form action={boundUpdateAgent} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="systemPrompt" className="text-sm font-medium">
              Instrucciones del agente de IA
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              defaultValue={business.agent?.systemPrompt}
              rows={8}
              required
              className="w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="enabled"
              name="enabled"
              type="checkbox"
              defaultChecked={business.agent?.enabled}
            />
            <label htmlFor="enabled" className="text-sm">
              Agente activo
            </label>
          </div>

          <div className="space-y-1">
            <label htmlFor="temperature" className="text-sm font-medium">
              Temperatura ({business.agent?.temperature})
            </label>
            <input
              id="temperature"
              name="temperature"
              type="range"
              min="0"
              max="1"
              step="0.1"
              defaultValue={business.agent?.temperature}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
          >
            Guardar cambios
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Conversaciones</h2>
        {conversations.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Aún no hay conversaciones en WhatsApp para este negocio.
          </p>
        )}
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/dashboard/businesses/${id}/conversations/${conversation.id}`}
                className="block py-3 hover:opacity-70"
              >
                <p className="font-medium">{conversation.customerName ?? conversation.customerPhone}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {conversation.customerPhone} · última actividad{" "}
                  {conversation.lastMessageAt.toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
