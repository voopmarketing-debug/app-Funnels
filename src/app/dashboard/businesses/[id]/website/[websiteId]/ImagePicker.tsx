"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { listWebsiteImagesV2, uploadWebsiteImageV2 } from "@/lib/actions";

type Photo = { url: string; label: string };

/**
 * "Cambiar imagen" window of the builder: the business's own photos (the same
 * library the AI agent and the gallery use) plus a button to upload a new one.
 * Picking a photo applies it right away.
 */
export function ImagePicker({
  businessId,
  title,
  help,
  current,
  removeLabel = "Quitar la imagen",
  onPick,
  onRemove,
  onClose,
}: {
  businessId: string;
  title: string;
  help: string;
  current: string | null;
  removeLabel?: string;
  onPick: (url: string) => void;
  onRemove: (() => void) | null;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    listWebsiteImagesV2(businessId)
      .then((list) => alive && setPhotos(list))
      .catch(() => alive && setError("No pudimos traer tus fotos. Intenta de nuevo."));
    return () => {
      alive = false;
    };
  }, [businessId]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      previous?.focus?.();
    };
  }, [onClose]);

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    startUpload(async () => {
      const res = await uploadWebsiteImageV2(businessId, form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // The new photo is used right away: that's what the person wanted when they uploaded it.
      onPick(res.url);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-picker-title"
        tabIndex={-1}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id="image-picker-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            <p className="text-[13px] text-ink-muted">{help}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <input
            ref={fileRef}
            id="website-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload(f);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong px-4 py-5 text-sm font-semibold text-ink transition hover:border-accent hover:bg-accent/5 disabled:opacity-60"
          >
            {uploading ? "Subiendo tu foto…" : "⬆ Subir una foto nueva"}
            <span className="font-normal text-ink-muted">JPG, PNG o WebP</span>
          </button>

          {error && <p className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm text-error">{error}</p>}

          {photos === null && !error && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          )}
          {photos && photos.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Todavía no tienes fotos. Sube la primera con el botón de arriba.</p>}
          {photos && photos.length > 0 && (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Tus fotos</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.url}>
                    <button
                      type="button"
                      onClick={() => onPick(p.url)}
                      title={p.label}
                      aria-label={`Usar la foto ${p.label}`}
                      className={`group relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-surface-2 transition hover:border-accent focus-visible:border-accent ${p.url === current ? "border-accent" : "border-transparent"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {p.url === current && <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">En uso</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {onRemove && (
          <div className="border-t border-border p-3">
            <button type="button" onClick={onRemove} className="rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink hover:border-error hover:text-error">
              {removeLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
