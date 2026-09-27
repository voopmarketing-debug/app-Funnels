"use client";

import { useRef, useState } from "react";

// A cross-origin <a download> is ignored by browsers, so for files on Vercel
// Blob the download is requested from the storage itself: "?download=1"
// makes it answer with Content-Disposition: attachment. data: URLs (older
// inline media) are same-origin, where the plain download attribute works.
function downloadHref(url: string): string {
  if (url.startsWith("data:")) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".blob.vercel-storage.com")) u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    return url;
  }
}

/** Chat image thumbnail that opens full-size, with zoom and download. */
export function ImageLightbox({ url, alt }: { url: string; alt: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);

  function close() {
    dialogRef.current?.close();
    setZoomed(false);
  }

  const toolbarButton =
    "rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20";

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="mb-1.5 block w-full cursor-zoom-in"
        aria-label="Ver imagen en grande"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external blob-storage URL, no next/image remote config */}
        <img src={url} alt={alt} className="max-h-64 w-full rounded-lg object-cover" />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setZoomed(false)}
        // Click on the dark backdrop (the dialog itself, not its content) closes it.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/90 p-0 backdrop:bg-black/80"
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-none items-center justify-end gap-2 p-3">
            <button type="button" onClick={() => setZoomed((z) => !z)} className={toolbarButton}>
              {zoomed ? "− Ajustar" : "+ Zoom"}
            </button>
            <a href={downloadHref(url)} download={alt} className={toolbarButton}>
              ↓ Descargar
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer" className={`${toolbarButton} hidden sm:inline-block`}>
              Abrir ↗
            </a>
            <button type="button" onClick={close} className={toolbarButton} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div
            className={`min-h-0 flex-1 ${zoomed ? "overflow-auto" : "flex items-center justify-center overflow-hidden p-3"}`}
            onClick={(e) => !zoomed && e.target === e.currentTarget && close()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external blob-storage URL, no next/image remote config */}
            <img
              src={url}
              alt={alt}
              onClick={() => setZoomed((z) => !z)}
              className={
                zoomed
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-full max-w-full cursor-zoom-in rounded-md object-contain"
              }
              style={zoomed ? { width: "200%" } : undefined}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
