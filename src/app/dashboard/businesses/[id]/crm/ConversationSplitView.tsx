import { ConversationThread } from "../ConversationThread";
import { LeadDetailPanel } from "../LeadDetailPanel";
import { ConversationList } from "./ConversationList";
import type { CrmStage, CrmConversation } from "../CrmBoard";

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
  // On mobile there's only room for one of {list, thread} at a time — which
  // one shows is driven by whether a conversation is selected (the same
  // `conv` URL param that already decides selectedConversation), so no
  // extra client state is needed. md: always shows both side by side,
  // exactly like before this change.
  const showListOnMobile = !selectedConversationId;

  const stageIndex = selectedConversation ? stages.findIndex((s) => s.id === selectedConversation.stageId) : -1;
  const stageProgress =
    stageIndex >= 0 ? { name: stages[stageIndex].name, index: stageIndex, total: stages.length } : null;

  return (
    // Mobile: an open chat fills the screen under the top bar (the CRM page
    // hides its own header while a chat is open — see crm/page.tsx), and
    // dvh keeps the composer above the phone browser's own toolbar instead
    // of behind it. Desktop sizing is unchanged.
    <div
      className={`fl-card flex overflow-hidden md:h-[calc(100dvh-16rem)] md:min-h-[30rem] ${
        showListOnMobile ? "h-[calc(100dvh-12rem)] min-h-[22rem]" : "h-[calc(100dvh-6rem)] min-h-[20rem]"
      }`}
    >
      <div
        className={`${showListOnMobile ? "flex" : "hidden md:flex"} w-full flex-col border-r border-border md:w-72 md:flex-none`}
      >
        <ConversationList stages={stages} conversations={conversations} selectedConversationId={selectedConversationId} />
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
            stage={stageProgress}
          />
        </div>
      )}
    </div>
  );
}
