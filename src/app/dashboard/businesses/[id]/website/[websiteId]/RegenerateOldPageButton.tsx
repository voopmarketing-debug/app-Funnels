"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateWebsitePage } from "@/lib/actions";

export function RegenerateOldPageButton({ businessId, websiteId }: { businessId: string; websiteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await regenerateWebsitePage(businessId, websiteId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo regenerar la página");
      }
    });
  }

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={regenerate}
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Regenerando... (puede tardar un minuto)" : "✨ Regenerar con IA"}
      </button>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
