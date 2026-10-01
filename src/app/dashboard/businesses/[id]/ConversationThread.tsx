import Link from "next/link";
import { ManualMessageForm } from "./conversations/[conversationId]/ManualMessageForm";
import { StageSelector } from "./conversations/[conversationId]/StageSelector";
import { AiPauseButton } from "./conversations/[conversationId]/AiPauseButton";
import { TemplateSendButton } from "./conversations/[conversationId]/TemplateSendButton";
import { MessageScrollArea } from "./MessageScrollArea";
import { contactInitial, contactLabel, formatPhone } from "@/lib/contactDisplay";
import { ContactFormDialog } from "./ContactFormDialog";
import { ImageLightbox } from "./ImageLightbox";
import { RetryReplyButton } from "./RetryReplyButton";

// This renders server-side, where the runtime clock is UTC (Vercel), not
// Bogotá — toLocaleTimeString() without a timeZone silently used that UTC
// offset, showing every message ~5h ahead of when it actually happened.
function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// "2026-10-01" in Bogotá — what decides which day separator a message falls under.
function bogotaDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(date);
}

function dayLabel(date: Date, todayKey: string, yesterdayKey: string): string {
  const key = bogotaDayKey(date);
  if (key === todayKey) return "Hoy";
  if (key === yesterdayKey) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

// Consecutive messages from the same sender within this gap read as one
// "turn": the sender's name and avatar show once, at the top of the turn.
const GROUP_GAP_MS = 5 * 60 * 1000;

type Sender = "customer" | "ai" | "human";

function senderOf(message: { role: "AGENT" | "CUSTOMER"; sentByHuman: boolean }): Sender {
  if (message.role === "CUSTOMER") return "customer";
  return message.sentByHuman ? "human" : "ai";
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

// The stored notice is "[ERROR INTERNO - IA|WHATSAPP] <raw error>" — this
// turns the common causes into something the business owner can act on.
function errorReason(content: string): string | null {
  if (/credit balance|billing/i.test(content)) return "Motivo: se acabó el saldo de Anthropic (la IA). Recarga y toca «Reintentar».";
  if (/authentication_error|invalid x-api-key|API key/i.test(content)) return "Motivo: la clave de la IA (Anthropic) no es válida.";
  if (/overloaded|529|rate_limit/i.test(content)) return "Motivo: la IA estaba saturada en ese momento.";
  if (/ERROR INTERNO - WHATSAPP/.test(content)) return "Motivo: WhatsApp rechazó el envío de la respuesta.";
  return null;
}

// WhatsApp-style ticks on our outbound messages, from Meta's delivery
// receipts — so "did the customer actually get it?" is visible at a glance,
// and an undelivered reply shows why instead of silently looking sent.
function DeliveryTicks({ status }: { status?: string | null }) {
  if (status === "failed") return <span className="font-bold text-error" title="No entregado">⚠</span>;
  if (status === "read") return <span className="font-bold text-sky-500" title="Leído">✓✓</span>;
  if (status === "delivered") return <span title="Entregado">✓✓</span>;
  if (status === "sent") return <span title="Enviado">✓</span>;
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
  const now = new Date();
  const todayKey = bogotaDayKey(now);
  const yesterdayKey = bogotaDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  // When Meta's 24h free-form window closes — the composer counts down to it.
  const lastCustomerMessage = messages.findLast((m) => m.role === "CUSTOMER");
  const windowExpiresAt = lastCustomerMessage
    ? new Date(lastCustomerMessage.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

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
        {messages.map((message, index) => {
          const prev = index > 0 ? messages[index - 1] : null;
          const showDay = !prev || bogotaDayKey(prev.createdAt) !== bogotaDayKey(message.createdAt);
          const daySeparator = showDay && (
            <div className="flex justify-center py-1">
              <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-[11px] font-medium capitalize text-ink-muted shadow-sm">
                {dayLabel(message.createdAt, todayKey, yesterdayKey)}
              </span>
            </div>
          );
          const isError = message.content.startsWith("[ERROR INTERNO");

          if (isError) {
            // A plain-language notice first — the raw API error is only
            // useful for debugging, so it's tucked away (and wrapped, so a
            // long JSON line can't push the chat wider than the screen).
            const reason = errorReason(message.content);
            return (
              <div key={message.id} className="space-y-2">
                {daySeparator}
                <div className="mx-auto w-full max-w-md rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-center text-xs text-ink">
                  <p className="font-semibold text-error">
                    ⚠ La IA no pudo responder este mensaje
                    <span className="ml-1.5 font-normal text-ink-faint">· {formatMessageTime(message.createdAt)}</span>
                  </p>
                  {reason && <p className="mt-0.5 text-ink-muted">{reason}</p>}
                  <details className="mt-1 text-left">
                    <summary className="cursor-pointer text-center text-ink-faint hover:text-ink-muted">Ver detalle técnico</summary>
                    <p className="fl-mono mt-1 break-all text-[10px] text-ink-muted">{message.content}</p>
                  </details>
                  {index === messages.length - 1 && <RetryReplyButton businessId={businessId} conversationId={conversationId} />}
                </div>
              </div>
            );
          }

          const sender = senderOf(message);
          const isOutbound = sender !== "customer";
          const startsTurn =
            showDay ||
            !prev ||
            prev.content.startsWith("[ERROR INTERNO") ||
            senderOf(prev) !== sender ||
            message.createdAt.getTime() - prev.createdAt.getTime() > GROUP_GAP_MS;
          const hasMedia = !!message.mediaUrl;
          // Inbound media with no real caption gets a bracketed placeholder
          // (e.g. "[Imagen]") so the AI's text-only history still reads
          // naturally — but once we're rendering the actual attachment, that
          // placeholder is redundant and gets hidden here.
          const isPlaceholderCaption = hasMedia && /^\[.*\]$/.test(message.content);
          const senderName = { customer: label, ai: "Agente IA", human: "Tu equipo" }[sender];
          const failed = message.deliveryStatus === "failed";

          return (
            <div key={message.id} className={startsTurn ? "space-y-2 pt-2 first:pt-0" : ""}>
              {daySeparator}
              <div className={`flex items-start gap-2.5 ${isOutbound ? "flex-row-reverse" : ""}`}>
                {/* Avatars only on desktop, once per turn — on a phone the
                    side, colour and name already say who's talking. */}
                <div className="hidden w-8 flex-none md:block">
                  {startsTurn && (
                    <Avatar
                      initial={sender === "customer" ? customerInitial : sender === "ai" ? "IA" : businessInitial}
                      variant={sender}
                    />
                  )}
                </div>
                <div
                  className={`min-w-0 max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm md:max-w-[72%] ${BUBBLE_STYLES[sender]} ${
                    startsTurn ? (isOutbound ? "rounded-tr-md" : "rounded-tl-md") : ""
                  }`}
                >
                  {startsTurn && (
                    <p className={`mb-0.5 flex items-center gap-1 text-xs font-semibold ${SENDER_STYLES[sender]}`}>
                      {sender === "ai" && <SparkIcon />}
                      <span className="truncate">{senderName}</span>
                    </p>
                  )}
                  {hasMedia && (
                    <MediaPreview url={message.mediaUrl!} type={message.mediaType ?? null} filename={message.mediaFilename ?? null} />
                  )}
                  {(!hasMedia || !isPlaceholderCaption) && message.content && (
                    <p className="whitespace-pre-wrap break-words text-ink">{message.content}</p>
                  )}
                  <p className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1 text-[10px] text-ink-faint">
                    {formatMessageTime(message.createdAt)}
                    {isOutbound && <DeliveryTicks status={message.deliveryStatus} />}
                  </p>
                  {failed && (
                    <p className="mt-1 border-t border-error/30 pt-1 text-[11px] font-medium text-error">
                      No entregado{message.deliveryError ? `: ${message.deliveryError}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted">Aún no hay mensajes en esta conversación.</p>
        )}
      </MessageScrollArea>

      <ManualMessageForm
        businessId={businessId}
        conversationId={conversationId}
        windowOpen={windowOpen}
        windowExpiresAt={windowExpiresAt}
        recipientLabel={label}
      />
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

// Who's talking is told three ways at once — side, colour and name — so it
// reads at a glance: the customer on the left in a neutral bubble, the AI on
// the right in the brand green, a person from the team on the right in violet.
const BUBBLE_STYLES: Record<Sender, string> = {
  customer: "border border-border bg-surface",
  ai: "border border-accent/25 bg-accent/10",
  human: "border border-accent-secondary/30 bg-accent-secondary/10",
};

const SENDER_STYLES: Record<Sender, string> = {
  customer: "text-ink",
  ai: "text-accent",
  human: "text-accent-secondary",
};

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 flex-none fill-current">
      <path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" />
    </svg>
  );
}

function Avatar({ initial, variant }: { initial: string; variant: Sender }) {
  const styles = {
    customer: "bg-surface-2 border border-border text-ink-muted",
    ai: "bg-accent text-accent-ink",
    human: "bg-accent-secondary text-white",
  }[variant];

  return (
    <div className={`fl-mono flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${styles}`}>
      {initial.slice(0, 2)}
    </div>
  );
}
