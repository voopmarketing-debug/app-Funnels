"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ADDON_PACKS } from "@/lib/addonPacks";
import { grantAddonManually } from "@/lib/addonActions";

/** Agency-only: see a client's active packs and grant one by hand. */
export function AddonGrantCell({
  ownerUserId,
  active,
}: {
  ownerUserId: string;
  active: { id: string; title: string; expiresAt: string }[];
}) {
  const router = useRouter();
  const [packKey, setPackKey] = useState(ADDON_PACKS[0].key);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function grant() {
    const pack = ADDON_PACKS.find((p) => p.key === packKey);
    if (!pack || !confirm(`¿Activar ${pack.title} por 30 días a este cliente?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await grantAddonManually(ownerUserId, packKey);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo activar");
      }
    });
  }

  return (
    <div className="min-w-[13rem] space-y-1.5">
      {active.map((a) => (
        <p key={a.id} className="text-xs text-ink">
          {a.title} <span className="text-ink-faint">· vence {a.expiresAt}</span>
        </p>
      ))}
      <div className="flex items-center gap-1.5">
        <select
          value={packKey}
          onChange={(e) => setPackKey(e.target.value)}
          aria-label="Paquete a activar"
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-ink outline-none focus:border-accent"
        >
          {ADDON_PACKS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={grant}
          disabled={isPending}
          className="flex-none rounded border border-border-strong px-2 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {isPending ? "…" : "Activar"}
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
