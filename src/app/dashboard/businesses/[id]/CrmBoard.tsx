"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";
import { STAGE_OPTIONS, STAGE_STYLES } from "@/lib/crmStages";

export type CrmConversation = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  stage: string;
  lastMessageAt: string;
};

export function CrmBoard({
  businessId,
  conversations,
}: {
  businessId: string;
  conversations: CrmConversation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStageChange(conversationId: string, newStage: string) {
    startTransition(async () => {
      await updateConversationStage(businessId, conversationId, newStage);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGE_OPTIONS.map((stageOption) => {
        const items = conversations.filter((c) => c.stage === stageOption.value);
        const style = STAGE_STYLES[stageOption.value];

        return (
          <div
            key={stageOption.value}
            className="flex w-64 flex-none flex-col rounded-lg border border-border bg-surface"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <p className="fl-mono text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {stageOption.label}
              </p>
              <span className="ml-auto text-xs text-ink-muted">{items.length}</span>
            </div>

            <div className="flex-1 space-y-2 p-2">
              {items.map((c) => (
                <div key={c.id} className={`rounded-md border ${style.border} bg-background p-2`}>
                  <Link
                    href={`/dashboard/businesses/${businessId}/conversations/${c.id}`}
                    className="block hover:opacity-80"
                  >
                    <p className="truncate text-sm font-medium">{c.customerName ?? c.customerPhone}</p>
                    <p className="truncate text-xs text-ink-muted">{c.customerPhone}</p>
                  </Link>
                  <select
                    value={c.stage}
                    disabled={isPending}
                    onChange={(e) => handleStageChange(c.id, e.target.value)}
                    className="fl-mono mt-2 w-full rounded border border-border bg-surface px-1.5 py-1 text-[10px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
                  >
                    {STAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {items.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-ink-faint">Vacío</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
