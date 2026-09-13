"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";
import { STAGE_OPTIONS } from "@/lib/crmStages";

export function StageSelector({
  businessId,
  conversationId,
  stage,
}: {
  businessId: string;
  conversationId: string;
  stage: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={stage}
      disabled={isPending}
      onChange={(e) => {
        const newStage = e.target.value;
        startTransition(async () => {
          await updateConversationStage(businessId, conversationId, newStage);
          router.refresh();
        });
      }}
      className="fl-mono rounded-md border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
    >
      {STAGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
