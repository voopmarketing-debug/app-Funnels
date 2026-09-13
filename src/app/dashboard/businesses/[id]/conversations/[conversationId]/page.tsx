import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ManualMessageForm } from "./ManualMessageForm";
import { StageSelector } from "./StageSelector";
import { AiPauseButton } from "./AiPauseButton";

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

  const business = await prisma.business.findUniqueOrThrow({ where: { id }, select: { name: true } });

  const customerInitial = (conversation.customerName?.trim()[0] ?? conversation.customerPhone.slice(-2)).toUpperCase();
  const businessInitial = business.name.trim()[0]?.toUpperCase() ?? "F";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Avatar initial={customerInitial} variant="customer" />
        <div className="flex-1">
          <h1 className="text-lg font-bold">{conversation.customerName ?? conversation.customerPhone}</h1>
          <p className="fl-mono text-xs tracking-wide text-ink-muted">{conversation.customerPhone}</p>
        </div>
        <AiPauseButton businessId={id} conversationId={conversationId} aiPaused={conversation.aiPaused} />
        <StageSelector businessId={id} conversationId={conversationId} stage={conversation.stage} />
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
          const bubble = (
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                isAgent
                  ? message.sentByHuman
                    ? "rounded-br-sm border-2 border-accent-secondary bg-background text-ink"
                    : "rounded-br-sm bg-accent text-accent-ink"
                  : "rounded-bl-sm border border-border bg-surface text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="mt-1 text-right text-[10px] opacity-60">
                {message.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );

          const avatar = isAgent ? (
            <Avatar
              initial={message.sentByHuman ? businessInitial : "IA"}
              variant={message.sentByHuman ? "human" : "ai"}
            />
          ) : (
            <Avatar initial={customerInitial} variant="customer" />
          );

          return (
            <div key={message.id} className={`flex items-end gap-2 ${isAgent ? "flex-row-reverse" : ""}`}>
              {avatar}
              <div className={`flex flex-col ${isAgent ? "items-end" : "items-start"}`}>
                {isAgent && message.sentByHuman && (
                  <span className="fl-mono mb-1 text-[10px] uppercase tracking-wide text-ink-muted">
                    Tú ({business.name})
                  </span>
                )}
                {isAgent && !message.sentByHuman && (
                  <span className="fl-mono mb-1 text-[10px] uppercase tracking-wide text-ink-muted">
                    Agente IA
                  </span>
                )}
                {bubble}
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

function Avatar({ initial, variant }: { initial: string; variant: "customer" | "ai" | "human" }) {
  const styles = {
    customer: "bg-surface-2 border border-border text-ink-muted",
    ai: "bg-accent text-accent-ink",
    human: "bg-accent-secondary text-accent-ink",
  }[variant];

  return (
    <div
      className={`fl-mono flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${styles}`}
    >
      {initial.slice(0, 2)}
    </div>
  );
}
