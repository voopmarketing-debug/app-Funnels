"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";
import { stageStyle } from "@/lib/crmStages";
import { contactInitial, contactLabel } from "@/lib/contactDisplay";
import { previewText, useListTimeFormatter } from "./crm/crmDisplay";

export type CrmStage = { id: string; name: string; position: number };

export type CrmConversation = {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string;
  stageId: string;
  lastMessageAt: string;
  unreadCount: number;
  // Only loaded for the chat list (Conversaciones tab).
  lastMessage?: { content: string; from: "customer" | "ai" | "human"; mediaType: string | null } | null;
  createdAt?: string;
  tags?: string[];
  appointmentAt?: string | null;
};

export function CrmBoard({
  businessId,
  stages,
  conversations,
}: {
  businessId: string;
  stages: CrmStage[];
  conversations: CrmConversation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  // Optimistic stage per card, so a dropped card lands instantly instead of
  // jumping back until the server refresh arrives.
  const [movedTo, setMovedTo] = useState<Record<string, string>>({});
  const formatTime = useListTimeFormatter();

  function moveToStage(conversationId: string, newStageId: string) {
    setMovedTo((prev) => ({ ...prev, [conversationId]: newStageId }));
    startTransition(async () => {
      await updateConversationStage(businessId, conversationId, newStageId);
      router.refresh();
    });
  }

  const stageOf = (c: CrmConversation) => movedTo[c.id] ?? c.stageId;

  return (
    // Kommo-style board: quiet columns with a coloured rule under each
    // header, cards that show who, when, the last message and tags.
    <div className="flex h-[calc(100dvh-20rem)] min-h-[26rem] snap-x gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const items = conversations.filter((c) => stageOf(c) === stage.id);
        const style = stageStyle(stage.position);
        const isDropTarget = dragOverStageId === stage.id;

        return (
          <section
            key={stage.id}
            aria-label={stage.name}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStageId(stage.id);
            }}
            onDragLeave={() => setDragOverStageId((prev) => (prev === stage.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              const conversationId = e.dataTransfer.getData("text/plain");
              setDragOverStageId(null);
              setDraggingId(null);
              if (conversationId) moveToStage(conversationId, stage.id);
            }}
            className={`flex w-[85vw] max-w-[19rem] flex-none snap-start flex-col rounded-xl transition sm:w-72 ${
              isDropTarget ? "bg-accent/10 ring-2 ring-accent/50" : "bg-surface-2/40"
            }`}
          >
            <header className="px-3 pt-3 text-center">
              <h3 className="truncate text-xs font-bold uppercase tracking-wider text-ink">{stage.name}</h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                {items.length} {items.length === 1 ? "contacto" : "contactos"}
              </p>
              <div className={`mt-2.5 h-0.5 rounded-full ${style.dot}`} />
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((c) => {
                const preview = previewText(c);
                const tags = c.tags ?? [];
                const isUnread = c.unreadCount > 0;
                return (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(c.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStageId(null);
                    }}
                    className={`group relative cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition hover:border-accent/50 active:cursor-grabbing ${
                      draggingId === c.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <div className="fl-mono flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-ink-muted">
                        {contactInitial(c.customerName, c.customerPhone).slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 pr-6">
                          <Link
                            href={`/dashboard/businesses/${businessId}/crm?tab=chat&conv=${c.id}`}
                            draggable={false}
                            className={`min-w-0 flex-1 truncate text-sm text-ink hover:text-accent ${isUnread ? "font-bold" : "font-semibold"}`}
                          >
                            {contactLabel(c.customerName, c.customerPhone)}
                          </Link>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
                          <span>{formatTime(c.lastMessageAt)}</span>
                          {isUnread && (
                            <span className="fl-mono flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink">
                              {c.unreadCount > 9 ? "9+" : c.unreadCount}
                            </span>
                          )}
                          {c.appointmentAt && <span title="Tiene cita agendada">📅</span>}
                        </p>
                        {preview && <p className="mt-1 line-clamp-2 break-words text-xs text-ink-muted">{preview}</p>}
                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tags.slice(0, 2).map((t) => (
                              <span key={t} className="max-w-full truncate rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-muted">
                                {t}
                              </span>
                            ))}
                            {tags.length > 2 && (
                              <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-faint">+{tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Moving without drag & drop (phones, keyboards): an icon
                        with an invisible native select laid over it. */}
                    <label
                      title="Mover a otra etapa"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M7 7h11l-3-3M17 17H6l3 3" />
                      </svg>
                      <select
                        value={stageOf(c)}
                        disabled={isPending}
                        onChange={(e) => moveToStage(c.id, e.target.value)}
                        aria-label={`Mover ${contactLabel(c.customerName, c.customerPhone)} a otra etapa`}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      >
                        {stages.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })}

              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-ink-faint">
                  {isDropTarget ? "Suelta aquí" : "Arrastra contactos aquí"}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
