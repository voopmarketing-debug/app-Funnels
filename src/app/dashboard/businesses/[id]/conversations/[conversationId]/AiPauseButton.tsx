"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleConversationAiPaused } from "@/lib/actions";

export function AiPauseButton({
  businessId,
  conversationId,
  aiPaused,
}: {
  businessId: string;
  conversationId: string;
  aiPaused: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleConversationAiPaused(businessId, conversationId, !aiPaused);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={
        aiPaused
          ? "La IA no está respondiendo en esta conversación"
          : "La IA responde automáticamente en esta conversación"
      }
      className={`fl-mono flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition disabled:opacity-60 ${
        aiPaused
          ? "border-error/50 bg-error/10 text-error"
          : "border-accent/50 bg-accent/10 text-accent"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${aiPaused ? "bg-error" : "bg-accent"}`} />
      {isPending ? "..." : aiPaused ? "IA pausada" : "IA activa"}
    </button>
  );
}
