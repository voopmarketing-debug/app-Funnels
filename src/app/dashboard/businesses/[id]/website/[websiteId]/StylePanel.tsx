"use client";

import { useEffect, useRef, useState } from "react";
import { ColorCodeInput } from "@/components/ColorCodeInput";
import { ColorSwatchButton } from "@/components/ColorSwatchButton";
import { SECTION_LABELS, type Section, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { tidyLook, type Look } from "@/lib/websiteLook";

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
  options: { value: T; label: string }[];
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
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${value === o.value ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-border-strong hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorRow({
  label,
  hint,
  value,
  autoLabel,
  swatches,
  onChange,
}: {
  label: string;
  hint: string;
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
        <p className="text-[12px] text-ink-muted">{hint}</p>
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
}: {
  section: Section;
  index: number;
  theme: WebsiteContentV2["theme"];
  busy: boolean;
  onLive: (look: Look | undefined) => void;
  onSave: (look: Look | undefined) => void;
  onPickBgImage: () => void;
  onGalleryLayout: (layout: "grid" | "mosaic" | "carousel") => void;
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
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
      <div>
        <p className="text-sm font-semibold text-ink">Estilo · {SECTION_LABELS[section.type]}</p>
        <p className="text-[12px] text-ink-muted">Bloque {index + 1}. Cada cambio se ve al instante en la página.</p>
      </div>

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
                  <span aria-hidden="true" className={`flex h-12 w-full gap-1 rounded-md bg-surface-2 p-1 ${value === "carousel" ? "" : "items-stretch"}`}>
                    {value === "grid" && [0, 1].map((c) => <span key={c} className="flex flex-1 flex-col gap-1"><span className="flex-1 rounded-sm bg-ink-faint/60" /><span className="flex-1 rounded-sm bg-ink-faint/60" /></span>)}
                    {value === "mosaic" && [[3, 2], [2, 3]].map((h, c) => <span key={c} className="flex flex-1 flex-col gap-1"><span style={{ flex: h[0] }} className="rounded-sm bg-ink-faint/60" /><span style={{ flex: h[1] }} className="rounded-sm bg-ink-faint/60" /></span>)}
                    {value === "carousel" && bars.map((_, c) => <span key={c} className={`rounded-sm bg-ink-faint/60 ${c === 0 ? "w-3/4 flex-none" : "w-1/3 flex-none"}`} />)}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ColorRow label="Color de fondo" hint={hasPhoto ? "Este bloque tiene foto de fondo: la foto manda." : "Pinta todo el bloque."} value={look.bg} autoLabel="Quitar" swatches={swatches} onChange={(hex) => change({ bg: hex })} />

      <button type="button" disabled={busy} onClick={onPickBgImage} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:border-accent disabled:opacity-50">
        <span>🖼 {hasPhoto ? "Cambiar la foto de fondo" : "Poner una foto de fondo"}</span>
        <span className="text-xs font-normal text-ink-muted">{hasPhoto ? "Activa" : "Opcional"}</span>
      </button>

      <ColorRow label="Color del texto" hint="Si no eliges uno, se ajusta solo para que se lea bien." value={look.color} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ color: hex })} />

      <ColorRow label="Color de los cuadros" hint="Las tarjetas y recuadros de este bloque (por ejemplo, el fondo detrás de cada foto). Si no eliges uno, se ajusta solo." value={look.surface} autoLabel="Automático" swatches={swatches} onChange={(hex) => change({ surface: hex })} />

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
          { value: "left", label: "Izquierda" },
          { value: "center", label: "Centro" },
          { value: "right", label: "Derecha" },
        ]}
      />
      <Segmented
        label="Tamaño de los títulos"
        value={look.size ?? null}
        onChange={(v) => change({ size: v })}
        options={[
          { value: null, label: "Normal" },
          { value: "sm", label: "Pequeño" },
          { value: "lg", label: "Grande" },
          { value: "xl", label: "Enorme" },
        ]}
      />
      <Segmented
        label="Mostrar este bloque en"
        hint="Útil para un bloque que solo tiene sentido en el celular o en el computador. Aquí lo ves siempre para poder editarlo."
        value={look.hideOn ?? null}
        onChange={(v) => change({ hideOn: v })}
        options={[
          { value: null, label: "Todas las pantallas" },
          { value: "mobile", label: "Solo computador" },
          { value: "desktop", label: "Solo celular" },
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
        className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-error hover:text-error disabled:opacity-40"
      >
        Quitar todos los cambios de este bloque
      </button>
    </div>
  );
}
