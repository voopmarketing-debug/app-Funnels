"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { deleteAgentMedia, saveAgentMedia } from "@/lib/actions";
import { MAX_ATTACHMENT_BYTES, maxMbFor, resolveMediaType } from "@/lib/attachmentLimits";
import { MAX_AGENT_MEDIA_PER_BUSINESS } from "@/lib/attachments";
import { askConfirm } from "@/components/ConfirmHost";

export type AgentMediaItem = {
  id: string;
  label: string;
  mediaType: string;
  filename: string | null;
  sizeBytes: number;
  url: string;
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AgentMediaManager({ businessId, media }: { businessId: string; media: AgentMediaItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const atLimit = media.length >= MAX_AGENT_MEDIA_PER_BUSINESS;

  function pickFile(picked: File | undefined) {
    setError(null);
    if (!picked) return setFile(null);
    const type = resolveMediaType(picked.type);
    if (type !== "image" && !(type === "document" && picked.type === "application/pdf")) {
      setFile(null);
      return setError("Elige una foto (JPG, PNG o WebP) o un PDF.");
    }
    if (picked.size > MAX_ATTACHMENT_BYTES[type]) {
      setFile(null);
      return setError(`Ese archivo pesa demasiado: el máximo es ${maxMbFor(type)} MB para ${type === "image" ? "fotos" : "PDFs"}.`);
    }
    setFile(picked);
  }

  function handleSubmit(formData: FormData) {
    if (!file) return;
    setError(null);
    setPercent(0);
    const label = String(formData.get("label") ?? "");
    startSubmitting(async () => {
      try {
        // Straight from the browser to storage: a PDF of several MB cannot go through the server.
        const blob = await upload(`agent-media/${businessId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "archivo"}`, file, {
          access: "public",
          handleUploadUrl: "/api/attachments/upload",
          clientPayload: JSON.stringify({ businessId }),
          contentType: file.type,
          onUploadProgress: ({ percentage }) => setPercent(Math.round(percentage)),
        });
        const result = await saveAgentMedia(businessId, { url: blob.url, label });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        formRef.current?.reset();
        setFile(null);
        router.refresh();
      } catch {
        setError("No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setPercent(null);
      }
    });
  }

  function handleDelete(mediaId: string) {
    setIsDeletingId(mediaId);
    startSubmitting(async () => {
      await deleteAgentMedia(businessId, mediaId);
      setIsDeletingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">

      <p className="mt-4 text-sm text-ink">
        Sube fotos de tus productos o un PDF (catálogo, ficha técnica, lista de precios). La IA decide por su cuenta
        enviárselo a un cliente por WhatsApp cuando lo pida o cuando claramente ayude a cerrar la venta. Si le pones una
        descripción, sabrá mejor cuándo usarlo.
      </p>

      {media.length > 0 && (
        <ul className="mt-4 space-y-2">
          {media.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(var(--glow-blue),0.12)] text-[rgb(var(--glow-blue))]">
                {item.mediaType === "document" ? <DocIcon /> : <PhotoIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{item.label}</p>
                <p className="fl-mono truncate text-[13px] text-ink-faint">
                  {item.filename ?? (item.mediaType === "document" ? "documento" : "foto")} · {formatSize(item.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                disabled={isDeletingId === item.id}
                onClick={async () => {
                  if (await askConfirm({ title: `¿Borrar "${item.label}"?`, message: "La IA ya no podrá enviarla a tus clientes.", confirmLabel: "Sí, borrar", tone: "danger" })) handleDelete(item.id);
                }}
                className="flex-none rounded border border-error/40 px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:opacity-30"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="mt-4 rounded-md border border-dashed border-border bg-background px-3 py-2.5 text-xs text-ink-muted">
          Llegaste al máximo de {MAX_AGENT_MEDIA_PER_BUSINESS} archivos. Deja solo tus productos más importantes —
          borra uno de la lista de arriba para poder subir otro.
        </p>
      ) : (
        <form ref={formRef} action={handleSubmit} className="mt-4 space-y-2 border-t border-border pt-4">
          <label htmlFor="media-file" className="block text-xs font-semibold text-ink">
            1. Elige la foto o el PDF
          </label>
          <input
            id="media-file"
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            disabled={isSubmitting}
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-ink outline-none file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent-ink"
          />
          <label htmlFor="media-label" className="block pt-1 text-xs font-semibold text-ink">
            2. Descríbelo <span className="font-normal text-ink-faint">(opcional)</span>
          </label>
          <input
            id="media-label"
            type="text"
            name="label"
            maxLength={200}
            placeholder='Ej: "Foto silla azul, $180.000" o "Catálogo completo de productos"'
            disabled={isSubmitting}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={isSubmitting || !file}
            className="mt-1 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50 sm:w-auto"
          >
            {isSubmitting ? (percent !== null && percent > 0 && percent < 100 ? `Subiendo… ${percent}%` : "Guardando…") : file ? "Guardar archivo" : "Elige un archivo para guardar"}
          </button>
          <p className="text-[13px] text-ink-faint">
            Fotos hasta 5 MB, PDFs hasta 20 MB — máximo {MAX_AGENT_MEDIA_PER_BUSINESS} archivos, deja solo tus
            productos más top.
          </p>
          {error && <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
        </form>
      )}
    </div>
  );
}

function PhotoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="2" />
      <path d="M5 16.5 9.5 12l3 3 3-3.5 3.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
