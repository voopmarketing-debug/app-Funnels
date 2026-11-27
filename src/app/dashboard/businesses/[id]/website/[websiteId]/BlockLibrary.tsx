"use client";

import { useEffect, useRef, useState } from "react";
import { BLOCK_LIBRARY, GROUP_LABELS, type BlockEntry } from "@/lib/websiteBlocks";
import { BLOCK_ICON, EXTRA_ICON, SearchIcon } from "./builderIcons";


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
                    {(() => { const I = BLOCK_ICON[b.type]; return <I className="h-[18px] w-[18px]" />; })()}
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

/** Drag payload of an element (text, button, photo) dropped inside a block of the page. */
export const NEW_EXTRA_MIME = "application/x-fl-new-extra";

const EXTRA_CARDS = [
  { kind: "heading", label: "Título", help: "Un título grande" },
  { kind: "text", label: "Texto", help: "Un párrafo debajo del título" },
  { kind: "button", label: "Botón", help: "Un botón con tu enlace" },
  { kind: "image", label: "Foto", help: "Una foto que se acomoda sola" },
] as const;

/** Elements that go INSIDE a block: tap to put one in the chosen block, or drag it onto a block of the page. */
export function ExtraGrid({ onPick, disabled }: { onPick: (kind: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Dentro de un bloque</p>
      <ul className="grid grid-cols-3 gap-1.5">
        {EXTRA_CARDS.map((c) => (
          <li key={c.kind}>
            <button
              type="button"
              disabled={disabled}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(NEW_EXTRA_MIME, c.kind);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onPick(c.kind)}
              title={c.help}
              className="flex w-full cursor-grab flex-col items-center gap-1 rounded-lg border border-border bg-background p-2 text-center transition hover:border-accent hover:bg-accent/5 active:cursor-grabbing disabled:opacity-50"
            >
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/12 text-accent">{(() => { const I = EXTRA_ICON[c.kind]; return <I className="h-[18px] w-[18px]" />; })()}</span>
              <span className="text-[12px] font-semibold text-ink">{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Desktop library: a search box and two-column tiles (big symbol, short name), grouped.
 * Tap a tile to add it, or drag it onto the page.
 */
export function TileLibrary({ onPick, onPickExtra, disabled, where }: { onPick: (type: BlockEntry["type"]) => void; onPickExtra: (kind: string) => void; disabled?: boolean; where: string }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (...texts: string[]) => !q || texts.some((t) => t.toLowerCase().includes(q));
  const extras = EXTRA_CARDS.filter((c) => match(c.label, c.help, "dentro elemento"));
  const groups = (Object.keys(GROUP_LABELS) as BlockEntry["group"][])
    .map((g) => ({ key: g, blocks: BLOCK_LIBRARY.filter((b) => b.group === g && match(b.label, b.help, GROUP_LABELS[g])) }))
    .filter((g) => g.blocks.length > 0);
  const tile = "group flex h-[5.25rem] w-full cursor-grab flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background p-2 text-center text-ink-muted transition hover:border-accent hover:bg-accent/5 hover:text-accent active:cursor-grabbing disabled:opacity-50";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Buscar elementos</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          id="block-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar elementos…"
          autoComplete="off"
          className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-accent"
        />
      </label>
      <p className="text-[12px] text-ink-muted">
        Arrastra a la página o toca: se agrega {where}.
      </p>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        {extras.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Dentro de un bloque</p>
            <ul className="grid grid-cols-2 gap-2">
              {extras.map((c) => (
                <li key={c.kind}>
                  <button
                    type="button"
                    disabled={disabled}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(NEW_EXTRA_MIME, c.kind);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onPickExtra(c.kind)}
                    title={c.help}
                    className={tile}
                  >
                    {(() => { const I = EXTRA_ICON[c.kind]; return <I className="h-7 w-7" />; })()}
                    <span className="text-[12px] font-medium leading-tight text-ink">{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{GROUP_LABELS[g.key]}</p>
            <ul className="grid grid-cols-2 gap-2">
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
                    className={tile}
                  >
                    {(() => { const I = BLOCK_ICON[b.type]; return <I className="h-7 w-7" />; })()}
                    <span className="text-[12px] font-medium leading-tight text-ink">{b.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {extras.length === 0 && groups.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Nada se llama «{query}». Prueba con otra palabra.</p>}
      </div>
    </div>
  );
}
