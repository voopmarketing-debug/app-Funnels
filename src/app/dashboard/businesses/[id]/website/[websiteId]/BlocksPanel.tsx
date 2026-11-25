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
  onEditHtml,
  onPickPhoto,
  onSaveEventDate,
  onHover,
}: {
  content: WebsiteContentV2;
  selected: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onOp: (op: BlockOp) => void;
  onStyle: (index: number) => void;
  onToggleHidden: (index: number) => void;
  /** Opens the window where the code of an HTML block is pasted. */
  onEditHtml: (index: number) => void;
  /** Opens the photo window (upload or pick from the catalog) for a picture slot of a block. */
  onPickPhoto: (index: number, field: "image" | "bgImage") => void;
  onSaveEventDate: (index: number, date: string) => Promise<boolean>;
  /** The pointer is on the row of a block (null: left the list): the page outlines that block. */
  onHover: (index: number | null) => void;
}) {
  // Open from the start: the elements are right there to drag onto the page.
  const [libraryOpen, setLibraryOpen] = useState(true);
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="space-y-2 max-md:order-2">
        <button
          type="button"
          onClick={() => setLibraryOpen((v) => !v)}
          aria-expanded={libraryOpen}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-accent/60 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/20"
        >
          <span>＋ Elementos</span>
          <span className="text-xs font-normal text-ink-muted">{libraryOpen ? "Cerrar" : "Abrir"}</span>
        </button>
        {libraryOpen && (
          <div className="max-h-[17rem] overflow-y-auto rounded-xl border border-border bg-background p-2.5">
            <p className="mb-2 text-[12px] text-ink-muted"><strong>Arrástralo a la página</strong> y suéltalo donde quieras, o tócalo para agregarlo{selected !== null && selected > 0 ? " debajo del bloque elegido" : " al final"}.</p>
            <BlockGrid compact disabled={busy} onPick={(type) => {
                setLibraryOpen(false);
                onOp({ kind: "add", type, at: selected !== null && selected > 0 ? selected + 1 : undefined });
              }}
            />
          </div>
        )}
      </div>

      {selected !== null && content.sections[selected]?.type === "event" && (
        <EventDateEditor key={`ev${selected}`} date={(content.sections[selected] as { date: string }).date} busy={busy} onSave={(date) => onSaveEventDate(selected, date)} />
      )}

      {selected !== null && content.sections[selected]?.type === "html" && (
        <button
          type="button"
          onClick={() => onEditHtml(selected)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border-2 border-accent bg-accent/15 px-3 py-3 text-left text-sm font-bold text-ink transition hover:bg-accent/25"
        >
          <span>
            <span className="font-mono">{"</>"}</span> {(content.sections[selected] as { code: string }).code.trim() ? "Editar el código HTML" : "Pegar el código HTML"}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}


      {hidden.size > 0 && (
        <p className="rounded-lg border border-border bg-background p-2.5 text-[12px] text-ink-muted">
          Hay {hidden.size} {hidden.size === 1 ? "bloque oculto" : "bloques ocultos"} (marcados «Oculto»): no se ven en tu página. Tócalo con 🚫 cuando tengas tus datos reales (testimonios, precio, garantía) y cambia el texto por el tuyo.
        </p>
      )}

      <div className="max-md:order-3"><PhotosCard content={content} selected={selected} busy={busy} onPick={onPickPhoto} /></div>

      <div className="space-y-2 max-md:order-1">
      <p className="text-sm font-bold text-ink">Bloques de tu página <span className="font-normal text-ink-muted">({count})</span></p>
      <p className="text-[12px] text-ink-faint">Toca <strong>🗑 Quitar</strong> para borrar un bloque. Si te equivocas, usa ↶ Deshacer arriba. Toca un bloque para ver más opciones.</p>

      <ol
        className="space-y-1.5"
        onDragOver={(e) => accepts(e) && e.preventDefault()}
        onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDropAt(null)}
      >
        {content.sections.map((s, i) => {
          const on = selected === i;
          const fixed = i === 0;
          return (
            <li key={i} className="relative" onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
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
                className={`group flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border p-2 transition ${on ? "border-accent bg-accent/10" : "border-border bg-background hover:border-border-strong"} ${hidden.has(i) ? "opacity-55" : ""} ${dragging === i ? "opacity-30" : ""}`}
              >
                <span aria-hidden="true" title={fixed ? "La portada va siempre primero" : "Arrastra para mover"} className={`flex-none select-none px-0.5 text-base leading-none ${fixed ? "text-ink-faint/40" : "cursor-grab text-ink-muted"}`}>
                  ⠿
                </span>
                <div className="min-w-0 flex-1 basis-24">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    {SECTION_LABELS[s.type]}
                    {s.look && <span className="rounded bg-accent/15 px-1 text-[9px] font-bold uppercase tracking-wide text-accent">Estilo</span>}
                    {hidden.has(i) && <span className="rounded bg-surface-2 px-1 text-[9px] font-bold uppercase tracking-wide text-ink-muted">Oculto</span>}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">{s.type === "html" ? (s.code.trim() ? `${s.code.length.toLocaleString("es")} caracteres de código` : "Vacío: pega tu código") : sectionTitle(s) || "—"}</p>
                  {s.type === "html" && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onEditHtml(i); }} className="mt-1 rounded-md bg-accent px-2 py-1 text-[11px] font-bold text-accent-ink">
                      {"</>"} {s.code.trim() ? "Editar código" : "Pegar código"}
                    </button>
                  )}
                </div>
                {fixed ? (
                  <span title="La portada va siempre primero y no se puede quitar" className="flex-none rounded bg-surface-2 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-muted">Fija</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Quitar el bloque ${SECTION_LABELS[s.type]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOp({ kind: "remove", index: i });
                    }}
                    className="flex h-9 flex-none items-center gap-1 rounded-lg border border-error/50 bg-error/10 px-2.5 text-xs font-bold text-error transition hover:bg-error/20 disabled:opacity-40"
                  >
                    <span aria-hidden="true">🗑</span> Quitar
                  </button>
                )}
                <div className={on ? "flex w-full flex-wrap items-center justify-end gap-1.5 pt-1" : "hidden items-center gap-1 sm:group-hover:flex sm:group-focus-within:flex"}>
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
    </div>
  );
}

/** The exact date of an event, for the countdown. The text people read ("Jueves 12, 7 p. m.") is written on the page itself. */
function EventDateEditor({ date, busy, onSave }: { date: string; busy: boolean; onSave: (date: string) => Promise<boolean> }) {
  const [value, setValue] = useState(date.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const dirty = value !== date.slice(0, 16);
  return (
    <div className="space-y-2 rounded-xl border border-accent/60 bg-accent/5 p-3">
      <p className="text-sm font-bold">Fecha de la cuenta regresiva</p>
      <p className="text-[12px] text-ink-muted">Elige el día y la hora (hora de Colombia). Vacío = sin cuenta regresiva. Mientras no escribas la fecha en la tarjeta, este bloque no se muestra al público.</p>
      <div className="flex gap-2">
        <label htmlFor="event-date" className="sr-only">Fecha y hora del evento</label>
        <input id="event-date" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent" />
        <button
          type="button"
          disabled={busy || saving || !dirty}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(value);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

/** The picture slots of the page in one place: upload a photo or pick one from the catalog or from the uploaded ones. */
function PhotosCard({ content, selected, busy, onPick }: { content: WebsiteContentV2; selected: number | null; busy: boolean; onPick: (index: number, field: "image" | "bgImage") => void }) {
  type Slot = { key: string; index: number; field: "image" | "bgImage"; label: string; url: string | null };
  const slots: Slot[] = [];
  content.sections.forEach((s, i) => {
    if (i === 0 && s.type === "hero" && s.variant !== "blank" && s.variant !== "product") slots.push({ key: `${i}image`, index: i, field: "image", label: "Foto de la portada", url: s.image ?? null });
    if (s.type === "host") slots.push({ key: `${i}image`, index: i, field: "image", label: "Foto de «Quién está detrás»", url: s.image ?? null });
    if (s.type === "promo") slots.push({ key: `${i}image`, index: i, field: "image", label: "Foto de la franja promocional", url: s.image ?? null });
  });
  if (selected !== null && content.sections[selected]) {
    const s = content.sections[selected];
    slots.push({ key: `${selected}bg`, index: selected, field: "bgImage", label: `Foto de fondo de «${SECTION_LABELS[s.type]}»`, url: s.bgImage ?? null });
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <p className="text-sm font-bold">🖼 Fotos de tu página</p>
      <p className="text-[12px] text-ink-muted">Sube tus fotos o elige las de tu catálogo y las que ya subiste. También puedes tocar cualquier imagen en la página para cambiarla.</p>
      <ul className="space-y-1.5">
        {slots.map((slot) => (
          <li key={slot.key}>
            <button type="button" disabled={busy} onClick={() => onPick(slot.index, slot.field)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-accent disabled:opacity-50">
              {slot.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.url} alt="" className="h-12 w-12 flex-none rounded-md object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-md border-2 border-dashed border-border-strong text-lg text-ink-muted">＋</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{slot.label}</span>
                <span className="block text-[12px] text-accent">{slot.url ? "Cambiar foto" : "Subir o elegir una foto"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
