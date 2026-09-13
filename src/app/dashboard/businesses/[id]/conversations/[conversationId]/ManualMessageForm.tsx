"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendManualMessage } from "@/lib/actions";

type SendState = { sentCount: number };

export function ManualMessageForm({
  businessId,
  conversationId,
}: {
  businessId: string;
  conversationId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<SendState, FormData>(
    async (prevState, formData) => {
      await sendManualMessage(businessId, conversationId, formData);
      return { sentCount: prevState.sentCount + 1 };
    },
    { sentCount: 0 },
  );

  useEffect(() => {
    if (!isPending) formRef.current?.reset();
  }, [isPending, state.sentCount]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-end gap-2 border-t border-border bg-surface p-3"
    >
      <textarea
        name="text"
        required
        rows={1}
        placeholder="Escribe como si fueras tú (interviene la conversación)..."
        className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2 text-sm text-ink outline-none focus:border-accent"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "..." : "Enviar"}
      </button>
    </form>
  );
}
