import { ManualMessageForm } from "./conversations/[conversationId]/ManualMessageForm";
import { StageSelector } from "./conversations/[conversationId]/StageSelector";
import { AiPauseButton } from "./conversations/[conversationId]/AiPauseButton";
import { MessageScrollArea } from "./MessageScrollArea";

// This renders server-side, where the runtime clock is UTC (Vercel), not
// Bogotá — toLocaleTimeString() without a timeZone silently used that UTC
// offset, showing every message ~5h ahead of when it actually happened.
function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatMessageDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

type ThreadMessage = {
  id: string;
  role: "AGENT" | "CUSTOMER";
  content: string;
  sentByHuman: boolean;
  createdAt: Date;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
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
  stages: { id: string; name: string; pipelineName?: string }[];
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

      <MessageScrollArea messageCount={messages.length}>
        {messages.map((message) => {
          const isError = message.content.startsWith("[ERROR INTERNO");

          if (isError) {
            return (
              <div
                key={message.id}
                className="mx-auto max-w-[90%] rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
              >
                <p>{message.content}</p>
                <p className="mt-1 opacity-70">{formatMessageDateTime(message.createdAt)}</p>
              </div>
            );
          }

          const isAgent = message.role === "AGENT";
          const hasMedia = !!message.mediaUrl;
          // Inbound media with no real caption gets a bracketed placeholder
          // (e.g. "[Imagen]") so the AI's text-only history still reads
          // naturally — but once we're rendering the actual attachment, that
          // placeholder is redundant and gets hidden here.
          const isPlaceholderCaption = hasMedia && /^\[.*\]$/.test(message.content);
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
              {hasMedia && (
                <MediaPreview url={message.mediaUrl!} type={message.mediaType ?? null} filename={message.mediaFilename ?? null} />
              )}
              {(!hasMedia || !isPlaceholderCaption) && message.content && (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              <p className="mt-1 text-right text-[10px] opacity-60">{formatMessageTime(message.createdAt)}</p>
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
      </MessageScrollArea>

      <ManualMessageForm businessId={businessId} conversationId={conversationId} />
    </div>
  );
}

function MediaPreview({ url, type, filename }: { url: string; type: string | null; filename: string | null }) {
  if (type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- external blob-storage URL, no next/image remote config
    return <img src={url} alt={filename ?? "Imagen adjunta"} className="mb-1.5 max-h-64 w-full rounded-lg object-cover" />;
  }
  if (type === "audio") {
    return <audio controls src={url} className="mb-1.5 w-56 max-w-full" />;
  }
  if (type === "video") {
    return <video controls src={url} className="mb-1.5 max-h-64 w-full rounded-lg" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-xs underline"
    >
      📄 {filename ?? "Documento"}
    </a>
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
