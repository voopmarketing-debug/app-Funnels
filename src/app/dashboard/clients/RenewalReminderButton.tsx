"use client";

import { useState, useTransition } from "react";
import { sendRenewalReminderNow } from "@/lib/renewalActions";

/** Emails the client the renewal link (the same message the automatic reminders send). */
export function RenewalReminderButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function send() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await sendRenewalReminderNow(userId);
        setResult(res.ok ? { ok: true, text: "✓ Enviado a su correo" } : { ok: false, text: res.error });
      } catch {
        setResult({ ok: false, text: "No se pudo enviar" });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={send} disabled={isPending} className="text-xs text-accent hover:underline disabled:opacity-50">
        {isPending ? "Enviando..." : "Enviar recordatorio de renovación"}
      </button>
      {result && <span className={`text-xs ${result.ok ? "text-ink-muted" : "text-error"}`}>{result.text}</span>}
    </div>
  );
}
