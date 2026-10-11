"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissNeedsHuman, toggleConversationAiPaused } from "@/lib/actions";

// Who answers this one chat: the AI agent or a person on the team. Pausing
// the AI here only affects this contact (e.g. one who only sends promos, or
// a client the business wants to attend personally).
export function AiPauseButton({
  businessId,
  conversationId,
  aiPaused,
  compact = false,
}: {
  businessId: string;
  conversationId: string;
  aiPaused: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paused, setPaused] = useOptimistic(aiPaused);

  function choose(nextPaused: boolean) {
    if (nextPaused === paused) return;
    startTransition(async () => {
      setPaused(nextPaused);
      await toggleConversationAiPaused(businessId, conversationId, nextPaused);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Quién responde este chat"
      className={`fl-seg flex-none ${compact ? "" : "grid w-full grid-cols-2"} ${isPending ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!paused}
        onClick={() => choose(false)}
        title="La IA responde sola en este chat"
        className="fl-seg-item whitespace-nowrap px-3 py-1.5 text-[13px]"
      >
        <span aria-hidden="true">🤖</span> {compact ? "IA" : "Responde la IA"}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={paused}
        onClick={() => choose(true)}
        title="La IA no responde en este chat: lo atiende una persona"
        className="fl-seg-item whitespace-nowrap px-3 py-1.5 text-[13px]"
      >
        <span aria-hidden="true">🙋</span> {compact ? "Tú" : "Respondo yo"}
      </button>
    </div>
  );
}

// Shown on top of the chat when it waits for a person: the customer sent
// something the AI can't read, or the AI is paused here.
export function HumanAttentionBanner({
  businessId,
  conversationId,
  aiPaused,
  needsHuman,
}: {
  businessId: string;
  conversationId: string;
  aiPaused: boolean;
  needsHuman: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  if (!needsHuman && !aiPaused) return null;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  if (needsHuman) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#fab219]/40 bg-[#fab219]/10 px-3 py-2.5 md:px-4">
        <p className="min-w-[12rem] flex-1 text-sm text-ink">
          <span className="font-semibold">🙋 Este chat te necesita.</span> Llegó algo que la IA no puede leer (publicidad de otra empresa, botones o una foto
          de «ver una vez»), así que no respondió. Míralo en el celular.
        </p>
        <div className="flex flex-none gap-2">
          {!aiPaused && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => toggleConversationAiPaused(businessId, conversationId, true))}
              className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent disabled:opacity-60"
            >
              Pausar la IA en este chat
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => dismissNeedsHuman(businessId, conversationId))}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            Ya lo revisé
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-2/70 px-3 py-2 md:px-4">
      <p className="min-w-[12rem] flex-1 text-sm text-ink-muted">
        <span className="font-semibold text-ink">🙋 Tú atiendes este chat.</span> La IA no responde a este contacto hasta que la vuelvas a activar.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => toggleConversationAiPaused(businessId, conversationId, false))}
        className="flex-none rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent disabled:opacity-60"
      >
        🤖 Que responda la IA
      </button>
    </div>
  );
}
