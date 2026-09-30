import Link from "next/link";
import { stageStyle } from "@/lib/crmStages";
import { contactInitial, contactLabel } from "@/lib/contactDisplay";
import { ConversationThread } from "../ConversationThread";
import { LeadDetailPanel } from "../LeadDetailPanel";
import type { CrmStage, CrmConversation } from "../CrmBoard";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} d`;
}

// WhatsApp-Web-style split inbox: every conversation on the left, the
// selected one's full thread on the right. Selection is a URL param
// (?tab=chat&conv=id) rather than client state, so the right pane can be
// server-rendered with real message data instead of fetching client-side.
export function ConversationSplitView({
  businessId,
  businessName,
  stages,
  conversations,
  selectedConversationId,
  selectedConversation,
  templates,
}: {
  businessId: string;
  businessName: string;
  stages: CrmStage[];
  conversations: CrmConversation[];
  selectedConversationId: string | null;
  templates: { id: string; name: string; bodyText: string }[];
  selectedConversation: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string;
    aiPaused: boolean;
    stageId: string;
    windowOpen: boolean;
    tags: string[];
    notes: string | null;
    appointmentAt: Date | null;
    appointmentNote: string | null;
    messages: {
      id: string;
      role: "AGENT" | "CUSTOMER";
      content: string;
      sentByHuman: boolean;
      createdAt: Date;
      mediaUrl: string | null;
      mediaType: string | null;
      mediaFilename: string | null;
      deliveryStatus: string | null;
      deliveryError: string | null;
    }[];
  } | null;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  // On mobile there's only room for one of {list, thread} at a time — which
  // one shows is driven by whether a conversation is selected (the same
  // `conv` URL param that already decides selectedConversation), so no
  // extra client state is needed. md: always shows both side by side,
  // exactly like before this change.
  const showListOnMobile = !selectedConversationId;

  return (
    // Mobile: an open chat fills the screen under the top bar (the CRM page
    // hides its own header while a chat is open — see crm/page.tsx), and
    // dvh keeps the composer above the phone browser's own toolbar instead
    // of behind it. Desktop sizing is unchanged.
    <div
      className={`fl-card flex overflow-hidden md:h-[calc(100dvh-21rem)] md:min-h-[28rem] ${
        showListOnMobile ? "h-[calc(100dvh-15rem)] min-h-[22rem]" : "h-[calc(100dvh-6rem)] min-h-[20rem]"
      }`}
    >
      <div
        className={`${showListOnMobile ? "flex" : "hidden md:flex"} w-full flex-col overflow-y-auto border-r border-border md:w-64 md:flex-none`}
      >
        {conversations.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-muted">Aún no hay conversaciones.</p>
        )}
        {conversations.map((c) => {
          const stage = stageById.get(c.stageId);
          const style = stage ? stageStyle(stage.position) : null;
          const initial = contactInitial(c.customerName, c.customerPhone);
          const isActive = c.id === selectedConversationId;
          const isUnread = c.unreadCount > 0;

          return (
            <Link
              key={c.id}
              href={`?tab=chat&conv=${c.id}`}
              className={`flex items-center gap-3 border-b border-border px-3 py-3 transition ${
                isActive ? "bg-accent/10" : isUnread ? "bg-accent/5 hover:bg-surface-2" : "hover:bg-surface-2"
              }`}
            >
              <div className="fl-mono flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-bold text-ink-muted">
                {initial.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${isUnread ? "font-bold text-ink" : "font-medium text-ink"}`}>
                  {contactLabel(c.customerName, c.customerPhone)}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted">
                  {style && <span className={`h-1.5 w-1.5 flex-none rounded-full ${style.dot}`} />}
                  {stage?.name ?? c.customerPhone}
                </p>
              </div>
              <div className="flex flex-none flex-col items-end gap-1">
                <span className={`fl-mono text-[10px] ${isUnread ? "font-semibold text-accent" : "text-ink-faint"}`}>
                  {formatRelativeTime(c.lastMessageAt)}
                </span>
                {isUnread && (
                  <span className="fl-mono flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className={`${showListOnMobile ? "hidden md:flex" : "flex"} min-w-0 flex-1 flex-col`}>
        {selectedConversation && selectedConversationId ? (
          <ConversationThread
            businessId={businessId}
            conversationId={selectedConversationId}
            businessName={businessName}
            customerName={selectedConversation.customerName}
            customerEmail={selectedConversation.customerEmail}
            customerPhone={selectedConversation.customerPhone}
            aiPaused={selectedConversation.aiPaused}
            stageId={selectedConversation.stageId}
            stages={stages}
            messages={selectedConversation.messages}
            templates={templates}
            windowOpen={selectedConversation.windowOpen}
            mobileBackHref="?tab=chat"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-muted">
            {conversations.length === 0
              ? "Todavía no hay conversaciones de WhatsApp para este negocio."
              : "Selecciona una conversación de la izquierda para ver los mensajes."}
          </div>
        )}
      </div>

      {selectedConversation && selectedConversationId && (
        // Desktop-only third column for now — on mobile the thread already
        // fills the screen (see above), and stacking a third full-width
        // panel under it would bury the chat itself. md:flex (not block) so
        // the panel is stretched to the card's height and scrolls itself —
        // as a block it grew to its content and the card clipped the bottom.
        <div className="hidden min-h-0 md:flex">
          <LeadDetailPanel
            // Keyed by conversation: the panel's fields are local state
            // seeded from props, so without a remount switching chats kept
            // showing the previous contact's name/notes/tags.
            key={selectedConversationId}
            businessId={businessId}
            conversationId={selectedConversationId}
            customerPhone={selectedConversation.customerPhone}
            customerName={selectedConversation.customerName}
            customerEmail={selectedConversation.customerEmail}
            tags={selectedConversation.tags}
            notes={selectedConversation.notes}
            appointmentAt={selectedConversation.appointmentAt}
            appointmentNote={selectedConversation.appointmentNote}
          />
        </div>
      )}
    </div>
  );
}
