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
        <h1 className="text-xl font-bold">{business.name}</h1>
        <p className="fl-mono text-xs tracking-wide text-ink-muted">
          WhatsApp: {business.wabaPhoneNumberId}
        </p>

        <form action={boundUpdateAgent} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="systemPrompt" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Instrucciones del agente de IA
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              defaultValue={business.agent?.systemPrompt}
              rows={8}
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="enabled"
              name="enabled"
              type="checkbox"
              defaultChecked={business.agent?.enabled}
              className="accent-[var(--accent)]"
            />
            <label htmlFor="enabled" className="text-sm">
              Agente activo
            </label>
          </div>

          <div className="space-y-1">
            <label htmlFor="temperature" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
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
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Guardar cambios
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Conversaciones</h2>
        {conversations.length === 0 && (
          <p className="text-sm text-ink-muted">
            Aún no hay conversaciones en WhatsApp para este negocio.
          </p>
        )}
        <ul className="divide-y divide-border">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/dashboard/businesses/${id}/conversations/${conversation.id}`}
                className="block py-3 transition hover:opacity-70"
              >
                <p className="font-medium">{conversation.customerName ?? conversation.customerPhone}</p>
                <p className="text-sm text-ink-muted">
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
