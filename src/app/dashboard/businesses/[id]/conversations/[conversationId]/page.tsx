import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; conversationId: string }>;
}) {
  const { id, conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
  });
  if (!membership) notFound();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId: id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">
        {conversation.customerName ?? conversation.customerPhone}
      </h1>
      <p className="fl-mono text-xs tracking-wide text-ink-muted">{conversation.customerPhone}</p>

      <div className="space-y-3">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              message.role === "AGENT"
                ? "ml-auto bg-accent text-accent-ink"
                : "border border-border bg-surface"
            }`}
          >
            <p>{message.content}</p>
            <p className="mt-1 text-xs opacity-60">{message.createdAt.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
