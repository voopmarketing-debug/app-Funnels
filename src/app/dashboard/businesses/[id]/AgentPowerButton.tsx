"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAgentEnabled } from "@/lib/actions";

export function AgentPowerButton({ businessId, enabled }: { businessId: string; enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // Turning it off stops every AI reply on this WhatsApp line, and on a
    // phone this button sits first in a swipeable row, where a stray tap is
    // easy — so switching off needs a confirmation. Turning on doesn't.
    if (enabled && !confirm("¿Apagar el agente? La IA dejará de responder a todos los clientes de este WhatsApp. Los mensajes seguirán llegando al CRM.")) {
      return;
    }
    startTransition(async () => {
      await toggleAgentEnabled(businessId, !enabled);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
        enabled
          ? "border-accent bg-accent text-accent-ink hover:bg-accent-hover"
          : "border-border bg-surface text-ink-muted hover:border-border-strong"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${enabled ? "bg-accent-ink" : "bg-ink-faint"}`} />
      {isPending ? "..." : enabled ? "Agente encendido" : "Agente apagado"}
    </button>
  );
}
