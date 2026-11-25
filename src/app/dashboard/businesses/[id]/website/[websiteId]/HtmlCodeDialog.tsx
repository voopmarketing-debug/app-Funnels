"use client";

import { useEffect, useRef, useState } from "react";
import { SAMPLE_HTML } from "@/lib/htmlSample";

/**
 * Where the owner pastes their own HTML: a big window that opens by itself when the "Código HTML"
 * block is added (or from its row / its bar in the page), so there is always an obvious place to paste.
 */
export function HtmlCodeDialog({
  code: initialCode,
  height: initialHeight,
  onSave,
  onClose,
}: {
  code: string;
  height: number;
  onSave: (code: string, height: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [height, setHeight] = useState(initialHeight);
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const dirty = code !== initialCode || height !== initialHeight;

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      if (await onSave(code, height)) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !dirty && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Pega tu código HTML" className="flex max-h-[100dvh] w-full max-w-3xl flex-col gap-3 rounded-t-2xl border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-ink shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Pega tu código HTML</h2>
            <p className="text-[12px] text-ink-muted">
              Pega aquí el código completo (HTML, CSS y JavaScript). Se muestra en un recuadro aislado de tu página: no puede cambiar el resto del sitio. Los formularios sin dirección propia (sin action) guardan el contacto en tu CRM: usa un campo de nombre y uno de correo o teléfono.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-lg hover:border-accent">
            ×
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          aria-label="Elegir un archivo HTML"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setFileError(null);
            if (f.size > 1_000_000) return setFileError("El archivo es muy pesado (máximo 100.000 caracteres de código).");
            try {
              setCode(await f.text());
            } catch {
              setFileError("No pudimos leer ese archivo. Prueba pegando el código.");
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:border-accent hover:text-accent">
            ⬆ Elegir un archivo .html
          </button>
          <button type="button" onClick={() => setCode(SAMPLE_HTML)} className="h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:border-accent hover:text-accent">
            ✨ Probar con un ejemplo
          </button>
        </div>
        {fileError && <p role="alert" className="text-sm text-error">{fileError}</p>}

        <label htmlFor="html-dialog-code" className="sr-only">Código HTML</label>
        <textarea
          id="html-dialog-code"
          ref={areaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={100000}
          placeholder={'Pega aquí tu código. Por ejemplo:\n<div style="padding:24px">\n  <h2>Hola</h2>\n</div>'}
          className="min-h-[34dvh] w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-[13px] leading-snug outline-none focus:border-accent sm:min-h-[22rem]"
        />

        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <label htmlFor="html-dialog-height" className="text-ink-muted">Alto del recuadro:</label>
          <select id="html-dialog-height" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-2 text-sm">
            <option value={0}>Automático</option>
            {[200, 300, 400, 500, 600, 800, 1000, 1400].map((h) => (
              <option key={h} value={h}>
                {h} px
              </option>
            ))}
          </select>
          <span className="ml-auto text-ink-faint">{code.length.toLocaleString("es")} / 100.000</span>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:border-accent sm:flex-none sm:px-5">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || (!dirty && !code.trim())}
            className="h-12 flex-[2] rounded-xl bg-accent px-5 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40 sm:flex-none"
          >
            {saving ? "Guardando…" : "Guardar y ver en mi página"}
          </button>
        </div>
      </div>
    </div>
  );
}
