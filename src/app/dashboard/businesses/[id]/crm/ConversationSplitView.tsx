import Link from "next/link";
import { stageStyle } from "@/lib/crmStages";
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
    }[];
  } | null;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return (
    <div className="fl-card flex h-[calc(100vh-14rem)] min-h-[28rem] overflow-hidden">
      <div className="flex w-64 flex-none flex-col overflow-y-auto border-r border-border">
        {conversations.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-muted">Aún no hay conversaciones.</p>
        )}
        {conversations.map((c) => {
          const stage = stageById.get(c.stageId);
          const style = stage ? stageStyle(stage.position) : null;
          const initial = (c.customerName?.trim()[0] ?? c.customerPhone.slice(-2)).toUpperCase();
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
                  {c.customerName ?? c.customerPhone}
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

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedConversation && selectedConversationId ? (
          <ConversationThread
            businessId={businessId}
            conversationId={selectedConversationId}
            businessName={businessName}
            customerName={selectedConversation.customerName}
            customerPhone={selectedConversation.customerPhone}
            aiPaused={selectedConversation.aiPaused}
            stageId={selectedConversation.stageId}
            stages={stages}
            messages={selectedConversation.messages}
            templates={templates}
            windowOpen={selectedConversation.windowOpen}
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
        <LeadDetailPanel
          businessId={businessId}
          conversationId={selectedConversationId}
          customerPhone={selectedConversation.customerPhone}
          tags={selectedConversation.tags}
          notes={selectedConversation.notes}
          appointmentAt={selectedConversation.appointmentAt}
          appointmentNote={selectedConversation.appointmentNote}
        />
      )}
    </div>
  );
}
