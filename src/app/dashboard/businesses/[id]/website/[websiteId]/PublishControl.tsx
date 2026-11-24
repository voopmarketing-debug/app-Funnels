"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setWebsitePublished } from "@/lib/actions";
import { askConfirm } from "@/components/ConfirmHost";

/**
 * "Publicada" / "Borrador" with the button to change it, like the Publicar button of a page
 * builder: a draft is seen only by the owner; publishing puts it at its public link.
 */
export function PublishControl({ businessId, websiteId, published }: { businessId: string; websiteId: string; published: boolean }) {
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
    if (!(await askConfirm({ title: "¿Pasar la página a borrador?", message: "Dejará de verse en su link: solo tú podrás verla. Puedes volver a publicarla cuando quieras.", confirmLabel: "Sí, pasar a borrador" }))) return;
    change(false);
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
          {pending ? "…" : "Despublicar"}
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
