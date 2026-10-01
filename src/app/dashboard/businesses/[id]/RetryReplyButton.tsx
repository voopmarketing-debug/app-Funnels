"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryConversationReply } from "@/lib/actions";

// Shown under the latest "La IA no pudo responder" notice — e.g. right after
// topping up the Anthropic balance, to answer the customer now instead of
// waiting for the automatic retry.
export function RetryReplyButton({ businessId, conversationId }: { businessId: string; conversationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await retryConversationReply(businessId, conversationId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
        className="rounded-md border border-error/50 bg-background px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {isPending ? "Respondiendo..." : "↻ Reintentar respuesta ahora"}
      </button>
      {error && <p className="text-[13px] text-error">{error}</p>}
    </div>
  );
}
