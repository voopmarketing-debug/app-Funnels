import { ManualMessageForm } from "./conversations/[conversationId]/ManualMessageForm";
import { StageSelector } from "./conversations/[conversationId]/StageSelector";
import { AiPauseButton } from "./conversations/[conversationId]/AiPauseButton";

type ThreadMessage = {
  id: string;
  role: "AGENT" | "CUSTOMER";
  content: string;
  sentByHuman: boolean;
  createdAt: Date;
};

// The message thread + composer for one WhatsApp conversation — shared by
// the standalone /conversations/[conversationId] page and the "Conversaciones"
// split view in the CRM (right-hand pane, WhatsApp-Web style). Both callers
// already have the conversation + business fetched, so this is pure render.
export function ConversationThread({
  businessId,
  conversationId,
  businessName,
  customerName,
  customerPhone,
  aiPaused,
  stageId,
  stages,
  messages,
}: {
  businessId: string;
  conversationId: string;
  businessName: string;
  customerName: string | null;
  customerPhone: string;
  aiPaused: boolean;
  stageId: string;
  stages: { id: string; name: string }[];
  messages: ThreadMessage[];
}) {
  const customerInitial = (customerName?.trim()[0] ?? customerPhone.slice(-2)).toUpperCase();
  const businessInitial = businessName.trim()[0]?.toUpperCase() ?? "F";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Avatar initial={customerInitial} variant="customer" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{customerName ?? customerPhone}</h2>
          <p className="fl-mono text-xs tracking-wide text-ink-muted">{customerPhone}</p>
        </div>
        <AiPauseButton businessId={businessId} conversationId={conversationId} aiPaused={aiPaused} />
        <StageSelector businessId={businessId} conversationId={conversationId} stageId={stageId} stages={stages} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
        {messages.map((message) => {
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
            <Avatar initial={message.sentByHuman ? businessInitial : "IA"} variant={message.sentByHuman ? "human" : "ai"} />
          ) : (
            <Avatar initial={customerInitial} variant="customer" />
          );

          return (
            <div key={message.id} className={`flex items-end gap-2 ${isAgent ? "flex-row-reverse" : ""}`}>
              {avatar}
              <div className={`flex flex-col ${isAgent ? "items-end" : "items-start"}`}>
                {isAgent && message.sentByHuman && (
                  <span className="fl-mono mb-1 text-[10px] uppercase tracking-wide text-ink-muted">
                    Tú ({businessName})
                  </span>
                )}
                {isAgent && !message.sentByHuman && (
                  <span className="fl-mono mb-1 text-[10px] uppercase tracking-wide text-ink-muted">Agente IA</span>
                )}
                {bubble}
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted">Aún no hay mensajes en esta conversación.</p>
        )}
      </div>

      <ManualMessageForm businessId={businessId} conversationId={conversationId} />
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
    <div className={`fl-mono flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${styles}`}>
      {initial.slice(0, 2)}
    </div>
  );
}
