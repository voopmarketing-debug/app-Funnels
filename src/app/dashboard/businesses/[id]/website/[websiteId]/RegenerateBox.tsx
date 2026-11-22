"use client";

import { useState } from "react";

/**
 * "Rehacer toda la página con IA": shows the brief the page was made from so it can be
 * edited or replaced by a new prompt, then remakes the page from scratch.
 */
export function RegenerateBox({
  savedBrief,
  busy,
  onRegenerate,
}: {
  savedBrief: string;
  busy: boolean;
  onRegenerate: (brief: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(savedBrief);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60"
      >
        Rehacer toda la página con IA
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <label htmlFor="regenerate-brief" className="block text-sm font-semibold">
        Pega aquí el prompt nuevo
      </label>
      <p className="text-xs text-ink-muted">
        Se reemplaza toda la página: textos, estilo y secciones. Usa las fotos y productos que ya tienes cargados. Si lo dejas como está, se rehace con el prompt anterior.
      </p>
      <textarea
        id="regenerate-brief"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={9}
        maxLength={6000}
        placeholder="Describe tu negocio y lo que quieres en la página…"
        className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onRegenerate(brief)}
          disabled={busy}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
        >
          Rehacer con este prompt
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
