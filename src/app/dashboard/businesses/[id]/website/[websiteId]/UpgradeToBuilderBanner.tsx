"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateWebsitePageV2 } from "@/lib/actions";

/** Pages made before the new builder: one click rebuilds them with the 12 styles + chat editor. */
export function UpgradeToBuilderBanner({ businessId, websiteId }: { businessId: string; websiteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upgrade() {
    if (!confirm("La IA va a rehacer esta página con el nuevo constructor (nuevos estilos y secciones). El diseño actual se reemplaza. ¿Continuar?")) return;
    setError(null);
    startTransition(async () => {
      const result = await regenerateWebsitePageV2(businessId, websiteId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="fl-card-hero flex flex-wrap items-center gap-4 p-4">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent text-lg text-accent-ink">✦</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Pásala al nuevo constructor con IA</p>
        <p className="text-xs text-ink-muted">12 estilos de diseño, tiendas y páginas de producto, y editas todo conversando con la IA con vista previa en vivo.</p>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
      <button type="button" onClick={upgrade} disabled={isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {isPending ? "Rehaciendo con IA… (≈1 min)" : "Actualizar página"}
      </button>
    </div>
  );
}
