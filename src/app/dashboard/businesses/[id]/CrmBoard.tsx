"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";
import { stageStyle } from "@/lib/crmStages";

export type CrmStage = { id: string; name: string; position: number };

export type CrmConversation = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  stageId: string;
  lastMessageAt: string;
  unreadCount: number;
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

  function moveToStage(conversationId: string, newStageId: string) {
    startTransition(async () => {
      await updateConversationStage(businessId, conversationId, newStageId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const items = conversations.filter((c) => c.stageId === stage.id);
        const style = stageStyle(stage.position);
        const isDropTarget = dragOverStageId === stage.id;

        return (
          <div
            key={stage.id}
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
            className={`flex w-64 flex-none flex-col rounded-lg border bg-surface transition ${
              isDropTarget ? "border-accent bg-accent/5" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <p className="fl-mono truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {stage.name}
              </p>
              <span className="ml-auto text-xs text-ink-muted">{items.length}</span>
            </div>

            <div className="flex-1 space-y-2 p-2">
              {items.map((c) => (
                <div
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
                  className={`cursor-grab rounded-md border ${style.border} bg-background p-2 active:cursor-grabbing ${
                    draggingId === c.id ? "opacity-40" : ""
                  }`}
                >
                  <Link
                    href={`/dashboard/businesses/${businessId}/conversations/${c.id}`}
                    className="block hover:opacity-80"
                  >
                    <p className="flex items-center gap-1.5">
                      <span className={`truncate text-sm ${c.unreadCount > 0 ? "font-bold" : "font-medium"}`}>
                        {c.customerName ?? c.customerPhone}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="fl-mono flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{c.customerPhone}</p>
                  </Link>
                  <select
                    value={c.stageId}
                    disabled={isPending}
                    onChange={(e) => moveToStage(c.id, e.target.value)}
                    className="fl-mono mt-2 w-full rounded border border-border bg-surface px-1.5 py-1 text-[10px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
                  >
                    {stages.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {items.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-ink-faint">
                  {isDropTarget ? "Suelta aquí" : "Vacío"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
