"use client";

import { useState } from "react";
import { SECTION_LABELS, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import type { BlockOp } from "@/lib/websiteBlocks";
import { AI_IMAGES_PER_PAGE, aiImagesInUse, planImageSlots } from "@/lib/websiteImages";
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
  onSaveHtml,
  onGenerateImages,
  onRemoveAiImages,
  onSaveEventDate,
}: {
  content: WebsiteContentV2;
  selected: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onOp: (op: BlockOp) => void;
  onStyle: (index: number) => void;
  onToggleHidden: (index: number) => void;
  onSaveHtml: (index: number, code: string, height: number) => Promise<boolean>;
  onGenerateImages: () => Promise<void>;
  onRemoveAiImages: () => Promise<void>;
  onSaveEventDate: (index: number, date: string) => Promise<boolean>;
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

      {selected !== null && content.sections[selected]?.type === "event" && (
        <EventDateEditor key={`ev${selected}`} date={(content.sections[selected] as { date: string }).date} busy={busy} onSave={(date) => onSaveEventDate(selected, date)} />
      )}

      <AiImagesCard content={content} busy={busy} onGenerate={onGenerateImages} onRemove={onRemoveAiImages} />

      {selected !== null && content.sections[selected]?.type === "html" && (
        <HtmlCodeEditor key={`${selected}`} section={content.sections[selected] as Extract<WebsiteContentV2["sections"][number], { type: "html" }>} busy={busy} onSave={(code, height) => onSaveHtml(selected, code, height)} />
      )}

      {hidden.size > 0 && (
        <p className="rounded-lg border border-border bg-background p-2.5 text-[12px] text-ink-muted">
          Hay {hidden.size} {hidden.size === 1 ? "bloque oculto" : "bloques ocultos"} (marcados «Oculto»): no se ven en tu página. Tócalo con 🚫 cuando tengas tus datos reales (testimonios, precio, garantía) y cambia el texto por el tuyo.
        </p>
      )}

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

/** Where the owner pastes their own HTML (widget, embed, form from another service, script). */
function HtmlCodeEditor({ section, busy, onSave }: { section: { code: string; height: number }; busy: boolean; onSave: (code: string, height: number) => Promise<boolean> }) {
  const [code, setCode] = useState(section.code);
  const [height, setHeight] = useState(section.height);
  const [saving, setSaving] = useState(false);
  const dirty = code !== section.code || height !== section.height;
  return (
    <div className="space-y-2 rounded-xl border border-accent/60 bg-accent/5 p-3">
      <p className="text-sm font-bold">Código HTML</p>
      <p className="text-[12px] text-ink-muted">Pega aquí tu código (HTML, CSS y JavaScript). Se muestra en un recuadro aislado de tu página: no puede cambiar el resto del sitio. Los formularios de este código no guardan contactos en tu CRM.</p>
      <label htmlFor="html-code" className="sr-only">Código HTML</label>
      <textarea
        id="html-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={10}
        maxLength={100000}
        placeholder={'<div style="padding:24px">Hola</div>'}
        className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[12px] leading-snug outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label htmlFor="html-height" className="text-ink-muted">Alto:</label>
        <select id="html-height" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value={0}>Automático</option>
          {[200, 300, 400, 500, 600, 800, 1000, 1400].map((h) => (
            <option key={h} value={h}>
              {h} px
            </option>
          ))}
        </select>
        <span className="ml-auto text-ink-faint">{code.length.toLocaleString("es")} / 100.000</span>
      </div>
      <button
        type="button"
        disabled={busy || saving || !dirty}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(code, height);
          } finally {
            setSaving(false);
          }
        }}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? "Guardando…" : dirty ? "Guardar código" : "Guardado"}
      </button>
    </div>
  );
}

/** "Generar imágenes con IA": fills the empty picture slots; any of them can be swapped for the owner's own photo by tapping it. */
function AiImagesCard({ content, busy, onGenerate, onRemove }: { content: WebsiteContentV2; busy: boolean; onGenerate: () => Promise<void>; onRemove: () => Promise<void> }) {
  const [working, setWorking] = useState<"make" | "remove" | null>(null);
  const used = aiImagesInUse(content);
  const room = Math.max(0, AI_IMAGES_PER_PAGE - used);
  const slots = planImageSlots(content, room).length;
  async function run(kind: "make" | "remove") {
    setWorking(kind);
    try {
      await (kind === "make" ? onGenerate() : onRemove());
    } finally {
      setWorking(null);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <p className="text-sm font-bold">🖼 Imágenes con IA</p>
      <p className="text-[12px] text-ink-muted">
        Llena con fotos de ambiente las imágenes vacías de tu página (máximo {AI_IMAGES_PER_PAGE}). Nunca crea personas: solo espacios y objetos de tu rubro. Toca cualquier imagen en la página para cambiarla por tu propia foto.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || working !== null || slots === 0}
          onClick={() => run("make")}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40"
        >
          {working === "make" ? "Creando… (puede tardar un minuto)" : slots === 0 ? "No hay espacios vacíos" : `✦ Generar imágenes con IA (${slots})`}
        </button>
        {used > 0 && (
          <button type="button" disabled={busy || working !== null} onClick={() => run("remove")} className="text-xs font-semibold text-ink-muted underline hover:text-ink disabled:opacity-40">
            {working === "remove" ? "Quitando…" : `Quitar las ${used} de IA`}
          </button>
        )}
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
