"use client";

import { useState, useTransition } from "react";
import { adminResetUserPassword } from "@/lib/actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await adminResetUserPassword(userId);
        setNewPassword(result.password);
      } catch {
        setError("No se pudo restablecer");
      }
    });
  }

  if (newPassword) {
    return (
      <div className="flex items-center gap-2">
        <code className="fl-mono rounded border border-border bg-background px-2 py-1 text-xs text-accent">
          {newPassword}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(newPassword);
            setCopied(true);
          }}
          className="text-xs text-ink-muted hover:text-ink"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-accent hover:underline disabled:opacity-50"
      >
        {isPending ? "Generando..." : "Restablecer contraseña"}
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
