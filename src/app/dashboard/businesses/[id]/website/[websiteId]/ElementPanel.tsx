"use client";

import { useState, type ReactNode } from "react";
import { BUTTON_LINK, SECTION_LABELS, type ExtraElement, type WebsiteContentV2 } from "@/lib/websiteContentV2";
import { stripMarks } from "@/lib/textMarks";
import { ButtonShapePicker } from "./ButtonShapePicker";
import { ColorRow } from "./StylePanel";
import { CloseIcon } from "./builderIcons";

export type Inspect = { path: string; kind: "button" | "text" };

type Style = { bg?: string | null; color?: string | null; shape?: string | null };

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
  onClose,
}: {
  content: WebsiteContentV2;
  inspect: Inspect;
  busy: boolean;
  onText: (path: string, value: string) => void;
  onLink: (path: string, url: string | null) => void;
  onStyle: (path: string, patch: Style) => void;
  onColor: (path: string, color: string | null) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"general" | "estilo">("general");
  const { path } = inspect;
  const header = path === "chrome.headerLabel";
  const m = /^sections\.(\d+)\.(.+)$/.exec(path);
  const section = m ? content.sections[Number(m[1])] : null;
  const key = m?.[2] ?? "";
  const extra = /^extras\.(\d+)\.label$/.exec(key);
  const extraItem = section && extra ? ((section.extras ?? [])[Number(extra[1])] as ExtraElement | undefined) : undefined;
  if (!header && !section) return null;

  const isButton = inspect.kind === "button";
  const raw = header
    ? (content.chrome?.headerLabel ?? "Escríbenos")
    : extraItem && extraItem.type === "button"
      ? extraItem.label
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
