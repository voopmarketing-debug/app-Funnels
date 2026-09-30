import Link from "next/link";
import { ManualMessageForm } from "./conversations/[conversationId]/ManualMessageForm";
import { StageSelector } from "./conversations/[conversationId]/StageSelector";
import { AiPauseButton } from "./conversations/[conversationId]/AiPauseButton";
import { TemplateSendButton } from "./conversations/[conversationId]/TemplateSendButton";
import { MessageScrollArea } from "./MessageScrollArea";
import { contactInitial, contactLabel, formatPhone } from "@/lib/contactDisplay";
import { ContactFormDialog } from "./ContactFormDialog";
import { ImageLightbox } from "./ImageLightbox";

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
  deliveryStatus?: string | null;
  deliveryError?: string | null;
};

// WhatsApp-style ticks on our outbound messages, from Meta's delivery
// receipts — so "did the customer actually get it?" is visible at a glance,
// and an undelivered reply shows why instead of silently looking sent.
function DeliveryTicks({ status, error }: { status?: string | null; error?: string | null }) {
  if (status === "failed") {
    return <span className="font-semibold text-error">⚠ No entregado{error ? `: ${error}` : ""}</span>;
  }
  if (status === "read") return <span className="font-semibold text-accent">✓✓ Leído</span>;
  if (status === "delivered") return <span>✓✓ Entregado</span>;
  if (status === "sent") return <span>✓ Enviado</span>;
  return null;
}

// The message thread + composer for one WhatsApp conversation — shared by
// the standalone /conversations/[conversationId] page and the "Conversaciones"
// split view in the CRM (right-hand pane, WhatsApp-Web style). Both callers
// already have the conversation + business fetched, so this is pure render.
export function ConversationThread({
  businessId,
  conversationId,
  businessName,
  customerName,
  customerEmail = null,
  customerPhone,
  aiPaused,
  stageId,
  stages,
  messages,
  templates,
  windowOpen,
  mobileBackHref,
}: {
  businessId: string;
  conversationId: string;
  businessName: string;
  customerName: string | null;
  customerEmail?: string | null;
  customerPhone: string;
  aiPaused: boolean;
  stageId: string;
  stages: { id: string; name: string; pipelineName?: string }[];
  messages: ThreadMessage[];
  templates: { id: string; name: string; bodyText: string }[];
  windowOpen: boolean;
  // Set only by the CRM split view (see ConversationSplitView.tsx), whose
  // narrow-screen layout shows either the conversation list or this thread,
  // never both — this link is how you get back to the list on mobile. Left
  // unset on the standalone /conversations/[conversationId] page, which has
  // its own breadcrumb already.
  mobileBackHref?: string;
}) {
  const customerInitial = contactInitial(customerName, customerPhone);
  const businessInitial = businessName.trim()[0]?.toUpperCase() ?? "F";
  const label = contactLabel(customerName, customerPhone);
  const phoneLabel = formatPhone(customerPhone);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Two rows on a phone (who → actions) so the name, phone and buttons
          never overlap; a single row from md up, same as before. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2.5 md:flex-nowrap md:px-4 md:py-3">
        {mobileBackHref && (
          <Link
            href={mobileBackHref}
            aria-label="Volver a las conversaciones"
            className="-ml-1 flex h-10 w-8 flex-none items-center justify-center text-2xl leading-none text-ink-muted transition hover:text-ink md:hidden"
          >
            ‹
          </Link>
        )}
        <Avatar initial={customerInitial} variant="customer" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold md:text-lg">{label}</h2>
          {label !== phoneLabel && <p className="fl-mono truncate text-xs tracking-wide text-ink-muted">{phoneLabel}</p>}
        </div>
        <div className="flex w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] md:w-auto md:flex-none md:overflow-visible">
          <TemplateSendButton
            businessId={businessId}
            conversationId={conversationId}
            templates={templates}
            windowOpen={windowOpen}
          />
          <AiPauseButton businessId={businessId} conversationId={conversationId} aiPaused={aiPaused} />
          <StageSelector businessId={businessId} conversationId={conversationId} stageId={stageId} stages={stages} />
          {/* Phones don't get the lead panel (desktop-only third column), so
              the contact's name/email are edited from here instead. */}
          <div className="flex-none md:hidden">
            <ContactFormDialog
              mode="edit"
              businessId={businessId}
              conversationId={conversationId}
              customerPhone={customerPhone}
              customerName={customerName}
              customerEmail={customerEmail}
              triggerClassName="whitespace-nowrap rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
            />
          </div>
        </div>
      </div>

      <MessageScrollArea messageCount={messages.length}>
        {messages.map((message) => {
          const isError = message.content.startsWith("[ERROR INTERNO");

          if (isError) {
            // A plain-language notice first — the raw API error is only
            // useful for debugging, so it's tucked away (and wrapped, so a
            // long JSON line can't push the chat wider than the screen).
            return (
              <div
                key={message.id}
                className="mx-auto w-full max-w-[90%] rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
              >
                <p className="font-semibold">⚠ La IA no pudo responder este mensaje</p>
                <details className="mt-1 text-left">
                  <summary className="cursor-pointer text-center opacity-80">Ver detalle técnico</summary>
                  <p className="fl-mono mt-1 break-all text-[10px] opacity-80">{message.content}</p>
                </details>
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
                {isAgent && message.deliveryStatus && (
                  <p className="mt-0.5 max-w-[80%] text-right text-[10px] text-ink-muted">
                    <DeliveryTicks status={message.deliveryStatus} error={message.deliveryError} />
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted">Aún no hay mensajes en esta conversación.</p>
        )}
      </MessageScrollArea>

      <ManualMessageForm businessId={businessId} conversationId={conversationId} windowOpen={windowOpen} />
    </div>
  );
}

function MediaPreview({ url, type, filename }: { url: string; type: string | null; filename: string | null }) {
  if (type === "image") {
    return <ImageLightbox url={url} alt={filename ?? "Imagen adjunta"} />;
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
