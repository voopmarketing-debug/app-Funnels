"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setWebsitePublished } from "@/lib/actions";
import { askConfirm } from "@/components/ConfirmHost";

/**
 * "Publicada" / "Borrador" with the button to change it, like the Publicar button of a page
 * builder: a draft is seen only by the owner; publishing puts it at its public link.
 */
export function PublishControl({ businessId, websiteId, published, variant = "bar" }: { businessId: string; websiteId: string; published: boolean; variant?: "bar" | "chip" }) {
  const router = useRouter();
  const [live, setLive] = useState(published);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setWebsitePublished(businessId, websiteId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLive(result.published);
      router.refresh();
    });
  }

  async function unpublish() {
    if (!(await askConfirm({ title: "¿Volver al editor?", message: "La página deja de verse en su link y queda como borrador: solo tú podrás verla. Puedes volver a publicarla cuando quieras.", confirmLabel: "Sí, volver al editor" }))) return;
    change(false);
  }

  // On a phone: one big tappable chip. A draft says "Publicar" and publishes at once; a published page asks first.
  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={live ? unpublish : () => change(true)}
        disabled={pending}
        aria-live="polite"
        className={`flex h-10 flex-none items-center gap-1.5 rounded-full px-3 text-xs font-bold disabled:opacity-60 ${live ? "bg-accent/15 text-accent" : "bg-accent text-accent-ink"}`}
      >
        {pending ? "…" : live ? "✓ Publicada" : "Publicar"}
        {error && <span className="sr-only">{error}</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex ${live ? "bg-accent/15 text-accent" : "bg-[rgba(245,158,11,0.16)] text-[rgb(180,100,0)]"}`}
        aria-live="polite"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-accent" : "bg-[rgb(217,119,6)]"}`} /> {live ? "Publicada" : "Borrador"}
      </span>
      {live ? (
        <button type="button" onClick={unpublish} disabled={pending} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-accent hover:text-ink disabled:opacity-60">
          {pending ? "…" : "Volver al editor"}
        </button>
      ) : (
        <button type="button" onClick={() => change(true)} disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
          {pending ? "Publicando…" : "Publicar"}
        </button>
      )}
      {error && <span className="max-w-[10rem] truncate text-[11px] text-error" title={error}>{error}</span>}
    </div>
  );
}
