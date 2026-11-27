"use client";

import { useEffect, useRef, useState } from "react";
import { ColorCodeInput } from "@/components/ColorCodeInput";
import { ColorSwatchButton } from "@/components/ColorSwatchButton";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import { SECTION_LABELS, type ExtraElement, type Section, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { tidyLook, type Look } from "@/lib/websiteLook";
import { ButtonShapePicker } from "./ButtonShapePicker";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, DesktopIcon, DevicesIcon, ImageIcon, PhoneIcon, RefreshIcon, TrashIcon } from "./builderIcons";

const SAVE_DELAY_MS = 500;

function Segmented<T extends string | null>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      {hint && <p className="text-[12px] text-ink-muted">{hint}</p>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            title={o.icon ? o.label : undefined}
            aria-label={o.icon ? o.label : undefined}
            className={`rounded-lg border text-xs font-semibold transition ${o.icon ? "flex h-9 min-w-9 items-center justify-center px-2" : "px-2.5 py-1.5"} ${value === o.value ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-border-strong hover:text-ink"}`}
          >
            {o.icon ?? o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Selecciona tu estructura": how many columns the block's content goes in, drawn as small grey layouts. */
const STRUCTURES: { value: string | null; label: string; cells: number[] }[] = [
  { value: null, label: "Automática", cells: [] },
  { value: "1", label: "1 columna", cells: [12] },
  { value: "2", label: "2 columnas", cells: [6, 6] },
  { value: "2-1", label: "2 columnas, ancha a la izquierda", cells: [8, 4] },
  { value: "1-2", label: "2 columnas, ancha a la derecha", cells: [4, 8] },
  { value: "3", label: "3 columnas", cells: [4, 4, 4] },
  { value: "4", label: "4 columnas", cells: [3, 3, 3, 3] },
];
/** The structure a block comes with (what the template draws when nothing was chosen), so the picker can show it as marked. */
function templateCols(section: { type: string; variant?: string; items?: unknown[] }): string | null {
  const n = Array.isArray(section.items) ? section.items.length : 0;
  const fit = (max: number) => String(Math.min(Math.max(n, 1), max));
  switch (section.type) {
    case "features":
      return section.variant === "bento" ? null : section.variant === "numbered" || section.variant === "list" ? "1" : fit(4);
    case "steps":
      return section.variant === "timeline" ? "1" : fit(4);
    case "testimonials":
      return fit(3);
    case "stats":
      return fit(4);
    case "trustBar":
    case "productGrid":
      return "4";
    case "gallery":
      return "3";
    case "host":
    case "productSpotlight":
    case "promo":
      return "2";
    default:
      return null;
  }
}

function StructurePicker({ value, suggested, onChange }: { value: string | null; suggested: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-ink">Estructura</p>
      <div role="radiogroup" aria-label="Estructura del bloque" className="flex flex-wrap gap-1.5">
        {STRUCTURES.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.label}
            title={value === null && o.value === suggested ? `${o.label} · así viene tu plantilla` : o.label}
            onClick={() => onChange(o.value)}
            className={`flex h-10 w-16 items-stretch gap-[2px] rounded-md border p-1 transition ${value === o.value ? "border-accent bg-accent/15" : value === null && o.value === suggested ? "border-dashed border-accent/70 bg-accent/5" : "border-border hover:border-border-strong"}`}
          >
            {o.cells.length === 0 ? (
              <span className="flex w-full items-center justify-center text-[10px] font-bold text-ink-muted">Auto</span>
            ) : (
              o.cells.map((w, i) => <span key={i} style={{ flex: w }} className={`rounded-[2px] ${value === o.value ? "bg-accent/60" : "bg-ink-faint/50"}`} />)
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A size as a percent: − and + buttons (easy on a phone), a slider, and "Normal" to go back. */
function SizeControl({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  const n = value ? Number(value) : 100;
  const set = (x: number) => {
    const c = Math.min(200, Math.max(50, Math.round(x / 5) * 5));
    onChange(c === 100 ? null : String(c));
  };
  const btn = "flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-lg font-bold text-ink transition hover:border-accent disabled:opacity-40";
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label={`Bajar ${label.toLowerCase()}`} onClick={() => set(n - 5)} disabled={n <= 50} className={btn}>−</button>
        <input type="range" min={50} max={200} step={5} value={n} aria-label={label} onChange={(e) => set(Number(e.target.value))} className="min-w-0 flex-1 basis-24 accent-[var(--accent,#7ac70c)]" />
        <button type="button" aria-label={`Subir ${label.toLowerCase()}`} onClick={() => set(n + 5)} disabled={n >= 200} className={btn}>+</button>
        <button type="button" onClick={() => onChange(null)} disabled={!value} className="h-10 flex-none rounded-lg border border-border px-2.5 text-xs font-semibold text-ink-muted transition hover:text-ink disabled:opacity-40">
          {value ? `${n}% · Normal` : "Normal"}
        </button>
      </div>
    </div>
  );
}

function FontPicker({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-ink" htmlFor={`font-${label}`}>{label}</label>
      <select
        id={`font-${label}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={value ? { fontFamily: `"${value}"` } : undefined}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-ink outline-none focus:border-accent md:text-sm"
      >
        <option value="">Automática (la de la página)</option>
        {FONT_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  );
}

/** Texts and buttons the owner adds inside a block, right under its title. */
function ExtrasEditor({ extras, busy, onChange, onPickPhoto }: { extras: ExtraElement[]; busy: boolean; onChange: (list: ExtraElement[]) => void; onPickPhoto: (at: number | null) => void }) {
  const [list, setList] = useState<ExtraElement[]>(extras);
  const full = list.length >= 6;
  const commit = (next: ExtraElement[]) => {
    setList(next);
    onChange(next);
  };
  const edit = (i: number, patch: Partial<{ text: string; label: string; url: string }>) => setList((l) => l.map((x, k) => (k === i ? ({ ...x, ...patch } as ExtraElement) : x)));
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div>
        <p className="text-[13px] font-semibold text-ink">Elementos dentro del bloque</p>
        <p className="text-[12px] text-ink-muted">Se agregan debajo del título del bloque.</p>
      </div>
      {list.map((x, i) => (
        <div key={i} className="space-y-1.5 rounded-lg bg-surface-2/60 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ink-muted">{x.type === "text" ? "Texto" : x.type === "image" ? "Foto" : "Botón"} {i + 1}</span>
            <button type="button" disabled={busy} onClick={() => commit(list.filter((_, k) => k !== i))} className="rounded-md border border-error/50 bg-error/10 px-2 py-1 text-[12px] font-bold text-error disabled:opacity-40"><TrashIcon className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />Quitar</button>
          </div>
          {x.type === "image" ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="" className="h-14 w-20 flex-none rounded-md border border-border bg-background object-contain" />
              <button type="button" disabled={busy} onClick={() => onPickPhoto(i)} className="h-10 flex-1 rounded-lg border border-border-strong text-sm font-bold text-ink hover:border-accent disabled:opacity-40">Cambiar foto</button>
            </div>
          ) : x.type === "text" ? (
            <textarea aria-label={`Texto ${i + 1}`} rows={3} maxLength={600} value={x.text} onChange={(e) => edit(i, { text: e.target.value })} onBlur={() => onChange(list)} className={field} />
          ) : (
            <>
              <input aria-label={`Texto del botón ${i + 1}`} maxLength={40} value={x.label} onChange={(e) => edit(i, { label: e.target.value })} onBlur={() => onChange(list)} placeholder="Texto del botón" className={field} />
              <input aria-label={`Enlace del botón ${i + 1}`} inputMode="url" maxLength={300} value={x.url} onChange={(e) => edit(i, { url: e.target.value })} onBlur={() => onChange(list)} placeholder="https://… (vacío = tu WhatsApp)" className={field} />
            </>
          )}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={busy || full} onClick={() => commit([...list, { type: "text", text: "Escribe aquí tu descripción." }])} className="h-11 rounded-lg bg-accent text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40">＋ Texto</button>
        <button type="button" disabled={busy || full} onClick={() => commit([...list, { type: "button", label: "Escríbenos", url: "" }])} className="h-11 rounded-lg border border-border-strong text-sm font-bold text-ink transition hover:border-accent disabled:opacity-40">＋ Botón</button>
        <button type="button" disabled={busy || full} onClick={() => onPickPhoto(null)} className="h-11 rounded-lg border border-border-strong text-sm font-bold text-ink transition hover:border-accent disabled:opacity-40">＋ Foto</button>
      </div>
    </div>
  );
}

export function ColorRow({
  label,
  hint,
  value,
  autoLabel,
  swatches,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null | undefined;
  autoLabel: string;
  swatches: string[];
  onChange: (hex: string | null) => void;
}) {
  const shown = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {hint && <p className="text-[12px] text-ink-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <ColorSwatchButton
          value={shown}
          label={label.toLowerCase()}
          sizeClass="h-9 w-9"
          roundedClass="rounded-lg"
          suggestions={swatches}
          onChange={(hex) => onChange(hex)}
          onClear={() => onChange(null)}
        />
        <ColorCodeInput value={shown ?? ""} label={label.toLowerCase()} onChange={(hex) => onChange(hex)} />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={!shown}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink disabled:opacity-40"
        >
          {autoLabel}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Colores de tu página">
        {swatches.map((c, i) => (
          <button key={`${c}-${i}`} type="button" title={c} aria-label={`Usar ${c}`} onClick={() => onChange(c)} className={`h-6 w-6 rounded-full border ${shown?.toLowerCase() === c.toLowerCase() ? "border-accent ring-2 ring-accent/40" : "border-black/15"}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

/**
 * "Estilo del bloque": the controls for one block (background, text color,
 * spacing, width, alignment, title size, which screens show it). Every change
 * shows at once in the preview (`onLive`) and is saved a moment later
 * (`onSave`), so dragging a color does not hit the server on every pixel.
 */
export function StylePanel({
  section,
  index,
  theme,
  busy,
  onLive,
  onSave,
  onPickBgImage,
  onGalleryLayout,
  onExtras,
  onPickExtraPhoto,
}: {
  section: Section;
  index: number;
  theme: WebsiteContentV2["theme"];
  busy: boolean;
  onLive: (look: Look | undefined) => void;
  onSave: (look: Look | undefined) => void;
  onPickBgImage: () => void;
  onGalleryLayout: (layout: "grid" | "mosaic" | "carousel") => void;
  onExtras: (list: ExtraElement[]) => void;
  onPickExtraPhoto: (at: number | null) => void;
}) {
  const [look, setLook] = useState<Look>(section.look ?? {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Look | undefined | "none">("none");
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== "none") {
      const value = pending.current;
      pending.current = "none";
      save.current(value);
    }
  };
  // Leaving the panel (another block, another tab) saves what is waiting.
  useEffect(() => flush, []);

  function change(patch: Partial<Look>) {
    const next = { ...look, ...patch } as Look;
    setLook(next);
    const tidy = tidyLook(next);
    onLive(tidy);
    pending.current = tidy;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  const swatches = [theme.primaryColor, theme.backgroundColor, theme.surfaceColor, theme.textColor, "#ffffff", "#0b0b0c"].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  const hasPhoto = !!section.bgImage;
  const changed = !!tidyLook(look);

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-3">
      <div>
        <p className="text-sm font-semibold text-ink">Estilo · {SECTION_LABELS[section.type]}</p>
        <p className="text-[12px] text-ink-muted">Bloque {index + 1}. Cada cambio se ve al instante en la página.</p>
      </div>

      <StructurePicker value={look.cols ?? null} suggested={templateCols(section as unknown as { type: string; variant?: string; items?: unknown[] })} onChange={(v) => change({ cols: v as Look["cols"] })} />
      <ExtrasEditor extras={section.extras ?? []} busy={busy} onChange={onExtras} onPickPhoto={onPickExtraPhoto} />

      {section.type === "gallery" && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink">Diseño de la galería</p>
          <div role="radiogroup" aria-label="Diseño de la galería" className="grid grid-cols-3 gap-2">
            {(
              [
                ["grid", "Cuadrícula", "Fotos ordenadas en filas iguales", [0, 1, 2, 3]],
                ["mosaic", "Mosaico", "Fotos de distintos tamaños, sin recortar", [3, 2, 2, 3]],
                ["carousel", "Banner", "Va pasando solo y se desliza con el dedo", [4, 4, 4]],
              ] as const
            ).map(([value, name, hint, bars]) => {
              const on = (section.layout ?? "grid") === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  title={hint}
                  onClick={() => onGalleryLayout(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center text-[12px] font-semibold transition disabled:opacity-50 ${on ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-border-strong hover:text-ink"}`}
                >
                  <span aria-hidden="true" className="flex h-12 w-full gap-1 overflow-hidden rounded-md bg-surface-2 p-1">
                    {value === "grid" && [0, 1].map((c) => <span key={c} className="flex flex-1 flex-col gap-1"><span className="flex-1 rounded-sm bg-ink-faint/60" /><span className="flex-1 rounded-sm bg-ink-faint/60" /></span>)}
                    {value === "mosaic" && [[3, 2], [2, 3]].map((h, c) => <span key={c} className="flex flex-1 flex-col gap-1"><span style={{ flex: h[0] }} className="rounded-sm bg-ink-faint/60" /><span style={{ flex: h[1] }} className="rounded-sm bg-ink-faint/60" /></span>)}
                    {value === "carousel" && bars.map((_, c) => <span key={c} className={`rounded-sm bg-ink-faint/60 ${c === 0 ? "w-3/4 flex-none" : "w-1/3 flex-none"}`} />)}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
          <ColorRow label="Fondo de las fotos" hint="El recuadro que va detrás de cada foto. Si no eliges uno, se ajusta solo." value={look.surface} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ surface: hex })} />
        </div>
      )}

      <ColorRow label="Color de fondo" hint={hasPhoto ? "La foto de fondo manda." : undefined} value={look.bg} autoLabel="Quitar" swatches={swatches} onChange={(hex) => change({ bg: hex })} />

      <button type="button" disabled={busy} onClick={onPickBgImage} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:border-accent disabled:opacity-50">
        <span><ImageIcon className="mr-1.5 inline h-4 w-4 -translate-y-px" />{hasPhoto ? "Cambiar la foto de fondo" : "Poner una foto de fondo"}</span>
        <span className="text-xs font-normal text-ink-muted">{hasPhoto ? "Activa" : "Opcional"}</span>
      </button>

      <ColorRow label="Color del texto" value={look.color} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ color: hex })} />

      <ButtonShapePicker label="Forma de los botones" value={look.btnShape} onChange={(v) => change({ btnShape: v })} />
      <ColorRow label="Color de los botones" hint="Solo los botones de este bloque." value={look.btn} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ btn: hex })} />

      {section.type !== "gallery" && (
        <ColorRow label="Color de los cuadros" value={look.surface} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ surface: hex })} />
      )}

      <Segmented
        label="Espacio arriba y abajo"
        value={look.padY ?? null}
        onChange={(v) => change({ padY: v })}
        options={[
          { value: null, label: "Normal" },
          { value: "none", label: "Ninguno" },
          { value: "sm", label: "Poco" },
          { value: "lg", label: "Mucho" },
          { value: "xl", label: "Enorme" },
        ]}
      />
      <Segmented
        label="Ancho del contenido"
        value={look.width ?? null}
        onChange={(v) => change({ width: v })}
        options={[
          { value: null, label: "Normal" },
          { value: "narrow", label: "Estrecho" },
          { value: "wide", label: "Ancho" },
          { value: "full", label: "Completo" },
        ]}
      />
      <Segmented
        label="Alineación del texto"
        value={look.align ?? null}
        onChange={(v) => change({ align: v })}
        options={[
          { value: null, label: "Automática" },
          { value: "left", label: "Izquierda", icon: <AlignLeftIcon className="h-[18px] w-[18px]" /> },
          { value: "center", label: "Centro", icon: <AlignCenterIcon className="h-[18px] w-[18px]" /> },
          { value: "right", label: "Derecha", icon: <AlignRightIcon className="h-[18px] w-[18px]" /> },
        ]}
      />
      <SizeControl label="Tamaño de los títulos" value={look.titleScale} onChange={(v) => change({ titleScale: v, size: null })} />
      <SizeControl label="Tamaño del texto" value={look.textScale} onChange={(v) => change({ textScale: v })} />
      <FontPicker label="Tipografía de los títulos" value={look.headingFont} onChange={(v) => change({ headingFont: v })} />
      <FontPicker label="Tipografía del texto" value={look.bodyFont} onChange={(v) => change({ bodyFont: v })} />
      <Segmented
        label="Mostrar en"
        value={look.hideOn ?? null}
        onChange={(v) => change({ hideOn: v })}
        options={[
          { value: null, label: "Todas las pantallas", icon: <DevicesIcon className="h-[18px] w-[18px]" /> },
          { value: "mobile", label: "Solo computador", icon: <DesktopIcon className="h-[18px] w-[18px]" /> },
          { value: "desktop", label: "Solo celular", icon: <PhoneIcon className="h-[18px] w-[18px]" /> },
        ]}
      />

      <button
        type="button"
        disabled={!changed || busy}
        onClick={() => {
          setLook({});
          onLive(undefined);
          pending.current = undefined;
          flush();
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-error hover:text-error disabled:opacity-40"
      >
        <RefreshIcon className="h-4 w-4" /> Restablecer bloque
      </button>
    </div>
  );
}
