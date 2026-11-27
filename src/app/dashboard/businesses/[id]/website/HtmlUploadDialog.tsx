"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createHtmlWebsite } from "@/lib/actions";
import { SAMPLE_HTML } from "@/lib/htmlSample";
import { SparklesIcon, UploadIcon } from "./[websiteId]/builderIcons";

const MAX = 100_000;

/**
 * "Subir mi HTML": the owner brings a whole page they made (an .html file picked from the phone or
 * computer, or pasted code) and it becomes a page of the platform. It is shown alone, inside an
 * isolated frame, so its code can run but cannot touch the platform.
 */
export function HtmlUploadDialog({ businessId, needsWhatsapp, onClose }: { businessId: string; needsWhatsapp: boolean; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  async function pickFile(file: File) {
    setError(null);
    if (file.size > 1_000_000) {
      setError("El archivo es muy pesado. El HTML puede tener hasta 100.000 caracteres (las imágenes van aparte, con un enlace).");
      return;
    }
    try {
      const text = await file.text();
      setCode(text);
      setFileName(file.name);
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80));
    } catch {
      setError("No pudimos leer ese archivo. Prueba pegando el código.");
    }
  }

  function create() {
    setError(null);
    if (!code.trim()) {
      setError("Elige un archivo .html o pega tu código primero.");
      return;
    }
    if (code.length > MAX) {
      setError(`El HTML es muy largo (${code.length.toLocaleString("es")} caracteres): el máximo es ${MAX.toLocaleString("es")}.`);
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    if (needsWhatsapp && (digits.length < 8 || digits.length > 15)) {
      setError("Escribe tu WhatsApp con el indicativo del país, por ejemplo +57 300 123 4567.");
      return;
    }
    startTransition(async () => {
      const res = await createHtmlWebsite(businessId, { name: name.trim() || undefined, html: code, whatsappNumber: needsWhatsapp ? whatsapp : undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/businesses/${businessId}/website/${res.id}`);
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Subir mi HTML" className="flex max-h-[100dvh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-ink shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Subir mi HTML</h2>
            <p className="text-[12px] text-ink-muted">Convierte una página que ya tienes en una página de tu cuenta. Se muestra sola, en un recuadro aislado: tu código funciona y no puede tocar el resto de la plataforma.</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Cerrar" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-lg hover:border-accent">
            ×
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          aria-label="Elegir un archivo HTML"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pickFile(f);
          }}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong px-3 text-sm font-semibold transition hover:border-accent hover:text-accent">
            <UploadIcon className="mr-1.5 inline h-4 w-4 -translate-y-px" /> {fileName ? "Cambiar archivo" : "Elegir un archivo .html"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCode(SAMPLE_HTML);
              setFileName(null);
              setName("Página de prueba");
              setError(null);
            }}
            className="flex h-14 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
          >
            <SparklesIcon className="mr-1.5 inline h-4 w-4 -translate-y-px" /> Probar con un ejemplo
          </button>
        </div>
        {fileName && <p className="text-[12px] text-ink-muted">Archivo: <strong className="text-ink">{fileName}</strong></p>}

        <label htmlFor="html-upload-code" className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          O pega tu código
        </label>
        <textarea
          id="html-upload-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFileName(null);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"<!doctype html>\n<html>…</html>"}
          className="min-h-[9rem] w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-snug outline-none focus:border-accent sm:min-h-[12rem]"
        />
        <p className="-mt-2 text-right text-[12px] text-ink-faint">
          {code.length.toLocaleString("es")} / {MAX.toLocaleString("es")} caracteres
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="html-upload-name" className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Nombre de la página
            </label>
            <input id="html-upload-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Mi página HTML" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-accent sm:text-sm" />
          </div>
          {needsWhatsapp && (
            <div>
              <label htmlFor="html-upload-wa" className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                Tu WhatsApp
              </label>
              <input id="html-upload-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="+57 300 123 4567" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-accent sm:text-sm" />
            </div>
          )}
        </div>

        <p className="rounded-lg bg-surface-2 p-2.5 text-[12px] text-ink-muted">
          Si tu HTML trae un formulario sin dirección propia (sin action), guardamos cada contacto en tu CRM: usa un campo de nombre y uno de correo o teléfono. Las imágenes deben estar en internet (un enlace https).
        </p>

        {error && <p role="alert" className="rounded-lg border border-error/40 bg-error/5 p-2.5 text-sm text-error">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="h-12 flex-1 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:border-accent sm:flex-none sm:px-5">
            Cancelar
          </button>
          <button type="button" onClick={create} disabled={pending || !code.trim()} className="h-12 flex-[2] rounded-xl bg-accent px-5 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-40 sm:flex-none">
            {pending ? "Creando tu página…" : "Crear mi página"}
          </button>
        </div>
      </div>
    </div>
  );
}
