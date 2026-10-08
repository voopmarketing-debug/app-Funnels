"use client";

import { useState, useTransition } from "react";
import { sendTestEmail, type EmailCheckResult } from "@/lib/emailCheck";

export function EmailCheckButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<EmailCheckResult | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTestEmail()))}
        className="rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-60"
      >
        {pending ? "Probando…" : "✉️ Probar correos"}
      </button>
      {result && (
        <p role="status" className={`max-w-xs text-right text-xs ${result.ok ? "text-[var(--status-good)]" : "text-error"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
