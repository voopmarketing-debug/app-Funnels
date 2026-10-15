"use client";

import { useEffect, useRef } from "react";
import { BLOCK_LIBRARY, GROUP_LABELS, type BlockEntry } from "@/lib/websiteBlocks";

const GLYPH: Record<BlockEntry["type"], string> = {
  features: "▦",
  steps: "①",
  host: "☺",
  gallery: "▣",
  productGrid: "🛍",
  productSpotlight: "★",
  promo: "▬",
  comparison: "⇄",
  trustBar: "✓",
  stats: "#",
  objections: "?",
  agenda: "▤",
  leadForm: "✉",
  cta: "➜",
};

/** Drag payload of a library block dropped onto the block list. */
export const NEW_BLOCK_MIME = "application/x-fl-new-block";

/** The block cards: click one to add it, or drag it to where it should go. */
export function BlockGrid({ onPick, disabled, compact = false }: { onPick: (type: BlockEntry["type"]) => void; disabled?: boolean; compact?: boolean }) {
  const groups = (Object.keys(GROUP_LABELS) as BlockEntry["group"][]).map((g) => ({ key: g, blocks: BLOCK_LIBRARY.filter((b) => b.group === g) }));
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{GROUP_LABELS[g.key]}</p>
          <ul className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
            {g.blocks.map((b) => (
              <li key={b.type}>
                <button
                  type="button"
                  disabled={disabled}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(NEW_BLOCK_MIME, b.type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onPick(b.type)}
                  title={b.help}
                  className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-border bg-background p-2 text-left transition hover:border-accent hover:bg-accent/5 active:cursor-grabbing disabled:opacity-50"
                >
                  <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-accent/12 text-base text-accent">
                    {GLYPH[b.type]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{b.label}</span>
                    {!compact && <span className="block text-[11.5px] leading-snug text-ink-muted">{b.help}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** "Agregar bloque" window (opened from the preview's toolbar): pick a block, it goes in at the chosen spot. */
export function BlockLibraryDialog({ onPick, onClose, where }: { onPick: (type: BlockEntry["type"]) => void; onClose: () => void; where: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="block-library-title" tabIndex={-1} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id="block-library-title" className="text-base font-semibold text-ink">
              Agregar un bloque
            </h2>
            <p className="text-[13px] text-ink-muted">Se agrega {where}. Después cambias sus textos tocándolos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BlockGrid onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
