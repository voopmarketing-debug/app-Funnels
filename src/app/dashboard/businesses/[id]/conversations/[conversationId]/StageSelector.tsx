"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";

export function StageSelector({
  businessId,
  conversationId,
  stageId,
  stages,
}: {
  businessId: string;
  conversationId: string;
  stageId: string;
  stages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={stageId}
      disabled={isPending}
      onChange={(e) => {
        const newStageId = e.target.value;
        startTransition(async () => {
          await updateConversationStage(businessId, conversationId, newStageId);
          router.refresh();
        });
      }}
      className="fl-mono rounded-md border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
    >
      {stages.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </select>
  );
}
