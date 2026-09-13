import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AgentForm } from "./AgentForm";
import { WabaCredentialsForm } from "./WabaCredentialsForm";

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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-xl font-bold">{business.name}</h1>
        <p className="fl-mono text-xs tracking-wide text-ink-muted">
          WhatsApp: {business.wabaPhoneNumberId}
        </p>

        <AgentForm
          businessId={id}
          systemPrompt={business.agent?.systemPrompt ?? ""}
          enabled={business.agent?.enabled ?? true}
          temperature={business.agent?.temperature ?? 0.7}
        />

        <WabaCredentialsForm businessId={id} wabaPhoneNumberId={business.wabaPhoneNumberId ?? ""} />
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
