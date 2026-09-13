import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AgentForm } from "./AgentForm";
import { WabaCredentialsForm } from "./WabaCredentialsForm";
import { CrmBoard } from "./CrmBoard";
import { AgentPowerButton } from "./AgentPowerButton";

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
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{business.name}</h1>
          <p className="fl-mono text-xs tracking-wide text-ink-muted">
            WhatsApp: {business.wabaPhoneNumberId}
          </p>
        </div>
        <AgentPowerButton businessId={id} enabled={business.agent?.enabled ?? true} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <AgentForm
          businessId={id}
          systemPrompt={business.agent?.systemPrompt ?? ""}
          tone={business.agent?.tone ?? "cercano"}
          replyLength={business.agent?.replyLength ?? "breve"}
          industry={business.industry}
        />

        <WabaCredentialsForm businessId={id} wabaPhoneNumberId={business.wabaPhoneNumberId ?? ""} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">CRM — Conversaciones por etapa</h2>
        {conversations.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Aún no hay conversaciones en WhatsApp para este negocio.
          </p>
        ) : (
          <CrmBoard
            businessId={id}
            conversations={conversations.map((c) => ({
              id: c.id,
              customerName: c.customerName,
              customerPhone: c.customerPhone,
              stage: c.stage,
              lastMessageAt: c.lastMessageAt.toISOString(),
            }))}
          />
        )}
      </section>
    </div>
  );
}
