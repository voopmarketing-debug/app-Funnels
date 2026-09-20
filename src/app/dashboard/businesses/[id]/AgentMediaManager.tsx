"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAgentMedia, deleteAgentMedia } from "@/lib/actions";
import { MAX_AGENT_MEDIA_PER_BUSINESS } from "@/lib/attachments";

// Distinct from --glow-secondary (agent instructions) and the custom
// WhatsApp green (credentials) so all three collapsible cards on this page
// read as separate things at a glance.
const TONE_VAR = "--glow-blue";

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
  const atLimit = media.length >= MAX_AGENT_MEDIA_PER_BUSINESS;

  function handleSubmit(formData: FormData) {
    setError(null);
    startSubmitting(async () => {
      try {
        await addAgentMedia(businessId, formData);
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
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
    <details
      className="group self-start overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `rgba(var(${TONE_VAR}), 0.28)`,
        background: `radial-gradient(120% 140% at 100% 0%, rgba(var(${TONE_VAR}), 0.16), transparent 60%), var(--surface)`,
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
          style={{ backgroundColor: `rgba(var(${TONE_VAR}), 0.16)`, color: `rgba(var(${TONE_VAR}), 1)` }}
        >
          <PhotoIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="fl-mono block text-xs tracking-wide text-ink uppercase">
            Fotos y catálogo para la IA ({media.length}/{MAX_AGENT_MEDIA_PER_BUSINESS})
          </span>
          <span className="mt-0.5 block text-xs normal-case text-ink-faint group-open:hidden">
            Haz clic para subir fotos o un PDF que la IA pueda enviar por WhatsApp.
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 flex-none transition-transform group-open:rotate-180"
          style={{ color: `rgba(var(${TONE_VAR}), 1)` }}
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <p className="mt-4 text-sm text-ink">
        Sube fotos de tus productos o un PDF (catálogo, ficha técnica, lista de precios). La IA decide por su cuenta
        enviárselo a un cliente por WhatsApp cuando lo pida o cuando claramente ayude a cerrar la venta — describe
        bien cada archivo para que sepa cuándo usarlo.
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
                <p className="fl-mono truncate text-[11px] text-ink-faint">
                  {item.filename ?? (item.mediaType === "document" ? "documento" : "foto")} · {formatSize(item.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                disabled={isDeletingId === item.id}
                onClick={() => {
                  if (confirm(`¿Borrar "${item.label}"? La IA ya no podrá enviarla.`)) handleDelete(item.id);
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
          <input
            type="text"
            name="label"
            required
            placeholder='Describe el archivo, ej: "Foto silla azul, $180.000" o "Catálogo completo de productos"'
            disabled={isSubmitting}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="file"
              name="file"
              accept="image/*,application/pdf"
              required
              disabled={isSubmitting}
              className="w-full flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-ink outline-none file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent-ink"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-none rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              {isSubmitting ? "Subiendo..." : "+ Agregar"}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">
            Fotos hasta 5 MB, PDFs hasta 20 MB — máximo {MAX_AGENT_MEDIA_PER_BUSINESS} archivos, deja solo tus
            productos más top.
          </p>
          {error && <p className="text-xs text-error">{error}</p>}
        </form>
      )}
    </details>
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
