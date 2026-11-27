"use client";

import { useState, type ReactNode } from "react";
import { BUTTON_LINK, SECTION_LABELS, type ExtraElement, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { stripMarks } from "@/lib/textMarks";
import { ButtonShapePicker } from "./ButtonShapePicker";
import { ColorRow } from "./StylePanel";
import { CloseIcon } from "./builderIcons";
import { toEmbedUrl } from "@/lib/websiteTemplate";
import { VIDEO_CAPS, VIDEO_PROVIDERS, providerOf, type VideoOpts, type VideoProvider } from "@/lib/videoEmbed";

export type Inspect = { path: string; kind: "button" | "text" | "video" };

type Style = { bg?: string | null; color?: string | null; shape?: string | null; w?: string | null; h?: string | null; fs?: string | null };

/**
 * "Editar botón" / "Editar texto": the settings of the element chosen on the page, in the way of a widget
 * panel: General (content, link) and Estilo (background, text color, shape), each in its own fold.
 */
export function ElementPanel({
  content,
  inspect,
  busy,
  onText,
  onLink,
  onStyle,
  onColor,
  onVideoUrl,
  onVideoOpts,
  onClose,
}: {
  content: WebsiteContentV2;
  inspect: Inspect;
  busy: boolean;
  onText: (path: string, value: string) => void;
  onLink: (path: string, url: string | null) => void;
  onStyle: (path: string, patch: Style) => void;
  onColor: (path: string, color: string | null) => void;
  onVideoUrl: (index: number, url: string) => void;
  onVideoOpts: (index: number, opts: Record<string, number | boolean | null>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"general" | "estilo">("general");
  const { path } = inspect;
  const header = path === "chrome.headerLabel";
  const m = /^sections\.(\d+)\.(.+)$/.exec(path);
  const section = m ? content.sections[Number(m[1])] : null;
  const key = m?.[2] ?? "";
  const extra = /^extras\.(\d+)\.label$/.exec(key);
  const cellMatch = /^cells\.(\d+)\.items\.(\d+)\.(label|text)$/.exec(key);
  const cellItem = section && section.type === "layout" && cellMatch ? (section.cells[Number(cellMatch[1])]?.items[Number(cellMatch[2])] as ExtraElement | undefined) : undefined;
  const extraItem = (section && extra ? ((section.extras ?? [])[Number(extra[1])] as ExtraElement | undefined) : undefined) ?? (cellItem && cellItem.type === "button" ? cellItem : undefined);
  if (!header && !section) return null;

  if (inspect.kind === "video" && section && section.type === "video" && m) {
    const index = Number(m[1]);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">Editar video</p>
            <p className="truncate text-[12px] text-ink-muted">YouTube, Vimeo, Wistia o Loom</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          <VideoFields key={`${index}:${section.url}`} url={section.url} opts={section.opts ?? {}} disabled={busy} onUrl={(u) => onVideoUrl(index, u)} onOpts={(o) => onVideoOpts(index, o)} />
        </div>
      </div>
    );
  }

  const isButton = inspect.kind === "button";
  const raw = header
    ? (content.chrome?.headerLabel ?? "Escríbenos")
    : extraItem && extraItem.type === "button"
      ? extraItem.label
      : cellItem && (cellItem.type === "text" || cellItem.type === "heading")
        ? cellItem.text
        : String((section as unknown as Record<string, unknown>)[key] ?? "");
  const text = stripMarks(raw);
  const hasMarks = text !== raw;
  const link = header ? (content.chrome?.headerLink ?? "") : extraItem && extraItem.type === "button" ? extraItem.url : (section?.links?.[key] ?? "");
  const style: Style = header ? { bg: content.chrome?.headerBtn ?? null } : ((section?.bs?.[key] as Style | undefined) ?? {});
  const textColor = header ? (content.chrome?.headerColor ?? null) : (section?.fc?.[key] ?? null);
  const theme = content.theme;
  const swatches = [theme.primaryColor, theme.backgroundColor, theme.surfaceColor, theme.textColor, "#ffffff", "#0b0b0c"].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  const where = header ? "Menú de arriba" : section ? SECTION_LABELS[section.type] : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{isButton ? "Editar botón" : "Editar texto"}</p>
          <p className="truncate text-[12px] text-ink-muted">{where}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <div role="tablist" aria-label="Ajustes del elemento" className="flex border-b border-border">
        {(["general", "estilo"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${tab === t ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {t === "general" ? "General" : "Estilo"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {tab === "general" && (
          <>
            <Fold title="Contenido">
              {isButton ? (
                <TextField key={`${path}:${raw}`} id="el-text" label="Texto del botón" value={text} disabled={busy} onSave={(v) => onText(path, v)} />
              ) : hasMarks ? (
                <p className="text-[12px] text-ink-muted">Este texto tiene partes de colores: escríbelo directo en la página.</p>
              ) : (
                <TextField key={`${path}:${raw}`} id="el-text" label="Texto" value={text} multiline disabled={busy} onSave={(v) => onText(path, v)} />
              )}
            </Fold>
            {isButton && (
              <Fold title="Configuración">
                <LinkField key={`${path}:${link}`} value={link} disabled={busy} placeholder={content.heroCtaUrl || "Por defecto: tu WhatsApp"} onSave={(v) => onLink(path, v)} />
              </Fold>
            )}
          </>
        )}
        {tab === "estilo" && (
          <>
            {isButton && (
              <>
                <Fold title="Fondo">
                  <ColorRow label="Color del botón" value={style.bg} autoLabel="Automático" swatches={swatches} onChange={(hex) => onStyle(path, { bg: hex })} />
                </Fold>
                {!header && (
                  <Fold title="Tamaño">
                    <RangeRow label="Ancho del botón" unit="%" min={20} max={100} step={5} auto="Automático" value={style.w} onChange={(v) => onStyle(path, { w: v })} />
                    <RangeRow label="Grosor (alto)" unit="px" min={6} max={50} step={2} auto="Automático" value={style.h} onChange={(v) => onStyle(path, { h: v })} />
                    <RangeRow label="Tamaño de las letras" unit="%" min={50} max={200} step={5} auto="Automático" value={style.fs} onChange={(v) => onStyle(path, { fs: v })} />
                  </Fold>
                )}
                {!header && (
                  <Fold title="Forma">
                    <ButtonShapePicker label="Esquinas" value={style.shape} onChange={(v) => onStyle(path, { shape: v })} />
                  </Fold>
                )}
              </>
            )}
            <Fold title="Texto">
              <ColorRow label="Color del texto" value={textColor} autoLabel="Automático" swatches={swatches} onChange={(hex) => onColor(path, hex)} />
            </Fold>
          </>
        )}
      </div>
    </div>
  );
}

/** A slider with its value; "Automático" puts the button's own size back. Saves when the pointer is released. */
function RangeRow({ label, unit, min, max, step, auto, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; auto: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  const [v, setV] = useState(value ? Number(value) : null);
  const shown = v ?? (unit === "%" && min === 50 ? 100 : max);
  const commit = (n: number | null) => onChange(n === null ? null : String(n));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <button type="button" disabled={v === null} onClick={() => { setV(null); commit(null); }} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-ink-muted transition hover:text-ink disabled:opacity-40">
          {v === null ? auto : `${v}${unit} · ${auto}`}
        </button>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => v !== null && commit(v)}
        onKeyUp={() => v !== null && commit(v)}
        className="w-full accent-[var(--accent,#7ac70c)]"
      />
    </div>
  );
}

const fmtTime = (n: number | undefined) => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : "");
/** "1:30" or "90" (seconds) → seconds; null when empty; undefined when it is not a time. */
function parseTime(v: string): number | null | undefined {
  const t = v.trim();
  if (!t) return null;
  const m = /^(?:(\d{1,3}):)?(\d{1,2})$/.exec(t) ?? /^(\d{1,5})$/.exec(t);
  if (!m) return undefined;
  const secs = m.length === 3 ? Number(m[1] ?? 0) * 60 + Number(m[2]) : Number(m[1]);
  return secs > 0 && secs <= 86400 ? secs : undefined;
}

/** "Editar video": the platform (a dropdown that tells each kind of link apart), the link and the player's options. */
function VideoFields({ url, opts, disabled, onUrl, onOpts }: { url: string; opts: VideoOpts; disabled: boolean; onUrl: (u: string) => void; onOpts: (o: Record<string, number | boolean | null>) => void }) {
  const detected = providerOf(toEmbedUrl(url));
  const [provider, setProvider] = useState<VideoProvider>(detected ?? "youtube");
  const [link, setLink] = useState(url);
  const [start, setStart] = useState(fmtTime(opts.start));
  const [end, setEnd] = useState(fmtTime(opts.end));
  const [error, setError] = useState<string | null>(null);
  const info = VIDEO_PROVIDERS.find((p) => p.key === provider)!;
  const caps = VIDEO_CAPS[provider];
  const input = "w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent";
  const saveLink = () => {
    const t = link.trim();
    if (t === url) return;
    if (t) {
      const found = providerOf(toEmbedUrl(t));
      if (!found) return setError(`Pega un enlace de ${info.label}.`);
      if (found !== provider) return setError(`Ese enlace es de ${VIDEO_PROVIDERS.find((p) => p.key === found)?.label}. Elige esa plataforma arriba o pega uno de ${info.label}.`);
    }
    setError(null);
    onUrl(t);
  };
  const saveTime = (k: "start" | "end", v: string) => {
    const n = parseTime(v);
    if (n === undefined) return setError("Escribe el tiempo como 1:30 o en segundos (90).");
    setError(null);
    if ((n ?? undefined) !== opts[k]) onOpts({ [k]: n });
  };
  const toggle = (k: keyof VideoOpts, label: string, on: boolean, value: (checked: boolean) => boolean) => (
    <label key={k} className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-ink">
      <span>{label}</span>
      <input type="checkbox" role="switch" disabled={disabled} checked={on} onChange={(e) => onOpts({ [k]: value(e.target.checked) })} className="h-5 w-9 cursor-pointer accent-[var(--accent,#7ac70c)]" />
    </label>
  );
  return (
    <>
      <Fold title="Contenido">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-ink">Plataforma</span>
          <select
            id="video-provider"
            value={provider}
            disabled={disabled}
            onChange={(e) => {
              setProvider(e.target.value as VideoProvider);
              setError(null);
            }}
            className={input}
          >
            {VIDEO_PROVIDERS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-ink">Enlace de {info.label}</span>
          <input id="video-link" inputMode="url" maxLength={300} disabled={disabled} value={link} placeholder={info.placeholder} onChange={(e) => setLink(e.target.value)} onBlur={saveLink} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={`${input} ${error ? "border-error" : ""}`} />
        </label>
        {error && <p className="text-[12px] text-error">{error}</p>}
        {caps.start && (
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-ink">Hora de inicio</span>
            <input id="video-start" disabled={disabled} value={start} placeholder="0:00" onChange={(e) => setStart(e.target.value)} onBlur={() => saveTime("start", start)} className={input} />
          </label>
        )}
        {caps.end && (
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-ink">Hora de finalización</span>
            <input id="video-end" disabled={disabled} value={end} placeholder="Hasta el final" onChange={(e) => setEnd(e.target.value)} onBlur={() => saveTime("end", end)} className={input} />
          </label>
        )}
      </Fold>
      <Fold title="Reproducción">
        <div className="space-y-3">
          {caps.autoplay && toggle("autoplay", "Auto-reproducir (sin sonido)", !!opts.autoplay, (c) => c)}
          {caps.mute && toggle("mute", "Silenciar", !!opts.mute, (c) => c)}
          {caps.loop && toggle("loop", "Bucle", !!opts.loop, (c) => c)}
          {caps.controls && toggle("controls", "Controles del reproductor", opts.controls !== false, (c) => c)}
          {caps.related && toggle("related", "Videos relacionados", opts.related !== false, (c) => c)}
        </div>
      </Fold>
    </>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group rounded-lg border border-border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-bold text-ink">
        {title}
        <span aria-hidden="true" className="text-ink-faint transition group-open:rotate-180">⌃</span>
      </summary>
      <div className="space-y-3 border-t border-border p-3">{children}</div>
    </details>
  );
}

function TextField({ id, label, value, multiline, disabled, onSave }: { id: string; label: string; value: string; multiline?: boolean; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const cls = "w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent";
  const commit = () => v.trim() !== value && v.trim() && onSave(v.trim());
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {multiline ? (
        <textarea id={id} rows={3} maxLength={600} disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} className={cls} />
      ) : (
        <input id={id} maxLength={80} disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={cls} />
      )}
    </label>
  );
}

function LinkField({ value, placeholder, disabled, onSave }: { value: string; placeholder: string; disabled: boolean; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value);
  const t = v.trim();
  const invalid = t !== "" && !BUTTON_LINK.test(t);
  const commit = () => {
    if (invalid || t === value) return;
    onSave(t || null);
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor="el-link" className="text-[13px] font-semibold text-ink">
        Enlace
      </label>
      <input
        id="el-link"
        inputMode="url"
        maxLength={300}
        disabled={disabled}
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`w-full rounded-md border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent ${invalid ? "border-error" : "border-border"}`}
      />
      {invalid ? <p className="text-[12px] text-error">Empieza con https://, tel:, mailto: o #.</p> : <p className="text-[12px] text-ink-muted">Vacío = tu WhatsApp.</p>}
      {value && (
        <button type="button" disabled={disabled} onClick={() => onSave(null)} className="text-[12px] font-semibold text-ink-muted underline hover:text-ink">
          Volver al enlace por defecto
        </button>
      )}
    </div>
  );
}
