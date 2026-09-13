import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ManualMessageForm } from "./ManualMessageForm";

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
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-surface px-4 py-3">
        <h1 className="text-lg font-bold">{conversation.customerName ?? conversation.customerPhone}</h1>
        <p className="fl-mono text-xs tracking-wide text-ink-muted">{conversation.customerPhone}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
        {conversation.messages.map((message) => {
          const isError = message.content.startsWith("[ERROR INTERNO");

          if (isError) {
            return (
              <div
                key={message.id}
                className="mx-auto max-w-[90%] rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
              >
                <p>{message.content}</p>
                <p className="mt-1 opacity-70">{message.createdAt.toLocaleString()}</p>
              </div>
            );
          }

          const isAgent = message.role === "AGENT";

          return (
            <div key={message.id} className={`flex flex-col ${isAgent ? "items-end" : "items-start"}`}>
              {isAgent && message.sentByHuman && (
                <span className="fl-mono mb-1 mr-1 text-[10px] uppercase tracking-wide text-ink-muted">
                  Tú
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  isAgent
                    ? message.sentByHuman
                      ? "rounded-br-sm border-2 border-accent bg-background text-ink"
                      : "rounded-br-sm bg-accent text-accent-ink"
                    : "rounded-bl-sm border border-border bg-surface text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">
                  {message.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}

        {conversation.messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted">Aún no hay mensajes en esta conversación.</p>
        )}
      </div>

      <ManualMessageForm businessId={id} conversationId={conversationId} />
    </div>
  );
}
