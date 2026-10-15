"use client";

import { useState } from "react";
import { SECTION_LABELS, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import type { BlockOp } from "@/lib/websiteBlocks";
import { BlockGrid, NEW_BLOCK_MIME } from "./BlockLibrary";

const MOVE_MIME = "application/x-fl-move-block";

function sectionTitle(s: WebsiteContentV2["sections"][number]): string {
  if ("heading" in s && typeof s.heading === "string") return s.heading;
  if (s.type === "trustBar") return s.items.map((i) => i.title).join(" · ");
  if (s.type === "stats") return s.items.map((i) => i.value).join(" · ");
  return "";
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-md border border-border bg-surface text-xs transition disabled:opacity-30 ${danger ? "hover:border-error hover:text-error" : "hover:border-accent"}`}
    >
      {children}
    </button>
  );
}

/**
 * The "Bloques" tab: every block of the page in order. Drag one by its handle
 * to move it, drag a card from the library to add one right there, or use the
 * buttons (they work on a phone too, where dragging does not).
 */
export function BlocksPanel({
  content,
  selected,
  busy,
  onSelect,
  onOp,
  onStyle,
  onToggleHidden,
}: {
  content: WebsiteContentV2;
  selected: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onOp: (op: BlockOp) => void;
  onStyle: (index: number) => void;
  onToggleHidden: (index: number) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const hidden = new Set(content.hidden);
  const count = content.sections.length;

  // Where a block dragged over a row would land: above it or below it.
  function slotFor(e: React.DragEvent, index: number): number {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(1, e.clientY < r.top + r.height / 2 ? index : index + 1);
  }

  function drop(e: React.DragEvent, at: number) {
    e.preventDefault();
    setDropAt(null);
    setDragging(null);
    const type = e.dataTransfer.getData(NEW_BLOCK_MIME);
    if (type) {
      onOp({ kind: "add", type: type as never, at });
      return;
    }
    const from = Number(e.dataTransfer.getData(MOVE_MIME));
    if (Number.isInteger(from) && from >= 1) onOp({ kind: "move", from, to: from < at ? at - 1 : at });
  }

  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(NEW_BLOCK_MIME) || e.dataTransfer.types.includes(MOVE_MIME);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setLibraryOpen((v) => !v)}
          aria-expanded={libraryOpen}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-accent/60 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/20"
        >
          <span>＋ Agregar un bloque</span>
          <span className="text-xs font-normal text-ink-muted">{libraryOpen ? "Cerrar" : "Elige uno"}</span>
        </button>
        {libraryOpen && (
          <div className="max-h-[17rem] overflow-y-auto rounded-xl border border-border bg-background p-2.5">
            <p className="mb-2 text-[12px] text-ink-muted">Toca uno para agregarlo{selected !== null && selected > 0 ? " debajo del bloque elegido" : " al final"}, o arrástralo al lugar que quieras.</p>
            <BlockGrid compact disabled={busy} onPick={(type) => {
                setLibraryOpen(false);
                onOp({ kind: "add", type, at: selected !== null && selected > 0 ? selected + 1 : undefined });
              }}
            />
          </div>
        )}
      </div>

      <p className="text-[12px] text-ink-faint">Arrastra ⠿ para reordenar. Toca un bloque para verlo en la página y cambiar su estilo.</p>

      <ol
        className="space-y-1.5"
        onDragOver={(e) => accepts(e) && e.preventDefault()}
        onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDropAt(null)}
      >
        {content.sections.map((s, i) => {
          const on = selected === i;
          const fixed = i === 0;
          return (
            <li key={i} className="relative">
              {dropAt === i && <span aria-hidden="true" className="absolute -top-1 left-0 right-0 z-10 h-0.5 rounded bg-accent" />}
              <div
                draggable={!fixed && !busy}
                onDragStart={(e) => {
                  e.dataTransfer.setData(MOVE_MIME, String(i));
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(i);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropAt(null);
                }}
                onDragOver={(e) => {
                  if (!accepts(e)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDropAt(slotFor(e, i));
                }}
                onDrop={(e) => drop(e, slotFor(e, i))}
                onClick={() => onSelect(i)}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${on ? "border-accent bg-accent/10" : "border-border bg-background hover:border-border-strong"} ${hidden.has(i) ? "opacity-55" : ""} ${dragging === i ? "opacity-30" : ""}`}
              >
                <span aria-hidden="true" title={fixed ? "La portada va siempre primero" : "Arrastra para mover"} className={`flex-none select-none px-0.5 text-base leading-none ${fixed ? "text-ink-faint/40" : "cursor-grab text-ink-muted"}`}>
                  ⠿
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    {SECTION_LABELS[s.type]}
                    {s.look && <span className="rounded bg-accent/15 px-1 text-[9px] font-bold uppercase tracking-wide text-accent">Estilo</span>}
                    {hidden.has(i) && <span className="rounded bg-surface-2 px-1 text-[9px] font-bold uppercase tracking-wide text-ink-muted">Oculto</span>}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">{sectionTitle(s) || "—"}</p>
                </div>
                <div className={`flex flex-none items-center gap-1 ${on ? "" : "sm:hidden sm:group-hover:flex sm:group-focus-within:flex"}`}>
                  <IconButton label="Estilo del bloque" onClick={() => onStyle(i)}>
                    🎨
                  </IconButton>
                  {!fixed && (
                    <>
                      <IconButton label="Subir" disabled={busy || i <= 1} onClick={() => onOp({ kind: "move", from: i, to: i - 1 })}>
                        ↑
                      </IconButton>
                      <IconButton label="Bajar" disabled={busy || i >= count - 1} onClick={() => onOp({ kind: "move", from: i, to: i + 1 })}>
                        ↓
                      </IconButton>
                      <IconButton label="Duplicar" disabled={busy} onClick={() => onOp({ kind: "duplicate", index: i })}>
                        ⧉
                      </IconButton>
                      <IconButton label={hidden.has(i) ? "Mostrar en la página" : "Ocultar de la página"} disabled={busy} onClick={() => onToggleHidden(i)}>
                        {hidden.has(i) ? "🚫" : "👁"}
                      </IconButton>
                      <IconButton label="Eliminar" danger disabled={busy} onClick={() => onOp({ kind: "remove", index: i })}>
                        🗑
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
              {i === count - 1 && dropAt === count && <span aria-hidden="true" className="absolute -bottom-1 left-0 right-0 z-10 h-0.5 rounded bg-accent" />}
            </li>
          );
        })}
        {/* Dropping below the last block */}
        <li
          aria-hidden="true"
          className="h-6"
          onDragOver={(e) => {
            if (!accepts(e)) return;
            e.preventDefault();
            setDropAt(count);
          }}
          onDrop={(e) => drop(e, count)}
        />
      </ol>
    </div>
  );
}
