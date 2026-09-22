"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createMessageTemplate, refreshTemplateStatus } from "@/lib/actions";

type TemplateButton = { type: "URL"; text: string; url: string };

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerImageUrl: string | null;
  buttons: TemplateButton[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: Date;
};

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "es_CO", label: "Español (Colombia)" },
  { value: "es_MX", label: "Español (México)" },
  { value: "en_US", label: "Inglés (EE. UU.)" },
];

const STATUS_STYLE: Record<Template["status"], string> = {
  PENDING: "bg-[#fab219]/15 text-[#fab219]",
  APPROVED: "bg-accent/15 text-accent",
  REJECTED: "bg-error/15 text-error",
};

const STATUS_LABEL: Record<Template["status"], string> = {
  PENDING: "En revisión",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

export function TemplateManager({
  businessId,
  templates,
  hasWabaId,
}: {
  businessId: string;
  templates: Template[];
  hasWabaId: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-4">
      {!hasWabaId && (
        <div className="rounded-md border-2 border-[#fab219]/50 bg-surface p-4 text-sm text-ink">
          Falta el <strong>WABA ID</strong> en las credenciales de WhatsApp de este negocio — sin eso, Meta no deja
          crear plantillas. Ve a la página del negocio, sección "Credenciales de WhatsApp", campo 3.
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        disabled={!hasWabaId}
        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
      >
        + Nueva plantilla
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="fl-card-hero max-h-[85vh] w-full max-w-3xl overflow-y-auto p-0"
      >
        <NewTemplateForm key={formKey} businessId={businessId} onClose={() => dialogRef.current?.close()} />
      </dialog>

      <div className="space-y-3">
        {templates.length === 0 && (
          <p className="fl-card p-4 text-center text-sm text-ink-muted">Todavía no hay plantillas creadas.</p>
        )}
        {templates.map((t) => (
          <TemplateCard key={t.id} businessId={businessId} template={t} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ businessId, template }: { businessId: string; template: Template }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="fl-card space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="fl-mono text-sm font-semibold text-ink">{template.name}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[template.status]}`}>
          {STATUS_LABEL[template.status]}
        </span>
        <span className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">
          {template.category} · {template.language}
        </span>
        {template.status === "PENDING" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => refreshTemplateStatus(businessId, template.id))}
            className="ml-auto text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            {isPending ? "Consultando..." : "↻ Revisar estado"}
          </button>
        )}
      </div>
      {template.headerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={template.headerImageUrl}
          alt=""
          className="h-32 w-full rounded-md border border-border object-cover"
        />
      )}
      <p className="whitespace-pre-wrap text-sm text-ink-muted">{template.bodyText}</p>
      {template.buttons.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {template.buttons.map((btn, i) => (
            <span
              key={i}
              className="rounded-md border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent"
              title={btn.url}
            >
              🔗 {btn.text}
            </span>
          ))}
        </div>
      )}
      {template.status === "REJECTED" && template.rejectionReason && (
        <p className="text-xs text-error">Motivo de Meta: {template.rejectionReason}</p>
      )}
    </div>
  );
}

/** Mimics a WhatsApp message bubble (header image, body, CTA buttons) so the admin sees roughly what the client will receive — same idea as Kommo's template preview. Not pixel-perfect, just close enough to catch mistakes before sending to Meta. */
function TemplateMessagePreview({
  headerImageUrl,
  bodyText,
  buttons,
}: {
  headerImageUrl: string | null;
  bodyText: string;
  buttons: { text: string }[];
}) {
  return (
    <div className="space-y-2 sm:sticky sm:top-16">
      <p className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Así se ve en WhatsApp</p>
      <div className="rounded-xl p-4" style={{ background: "#0b141a" }}>
        <div className="ml-auto max-w-[240px] overflow-hidden rounded-lg rounded-tr-sm shadow-sm" style={{ background: "#005c4b" }}>
          {headerImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerImageUrl} alt="" className="h-28 w-full object-cover" />
          )}
          <div className="px-2.5 pt-2 pb-1.5">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-white">
              {bodyText.trim() || "Escribe el mensaje para verlo aquí..."}
            </p>
            <p className="mt-1 text-right text-[10px] text-white/60">10:42 a. m. ✓✓</p>
          </div>
          {buttons.length > 0 && (
            <div className="border-t border-white/15">
              {buttons.map((btn, i) => (
                <div
                  key={i}
                  className={`px-2 py-2 text-center text-[13px] font-medium ${i > 0 ? "border-t border-white/15" : ""}`}
                  style={{ color: "#53bdeb" }}
                >
                  🔗 {btn.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type FormState = { error: string | null; done: boolean };
const INITIAL_STATE: FormState = { error: null, done: false };

function NewTemplateForm({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    try {
      await createMessageTemplate(businessId, formData);
      return { error: null, done: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo crear la plantilla", done: false };
    }
  }, INITIAL_STATE);

  // Mirrors just the fields the preview needs — everything else (name,
  // language, category) stays an uncontrolled field submitted normally.
  const [bodyText, setBodyText] = useState("");
  const [headerImagePreviewUrl, setHeaderImagePreviewUrl] = useState<string | null>(null);
  const [button1Text, setButton1Text] = useState("");
  const [button2Text, setButton2Text] = useState("");

  useEffect(() => {
    return () => {
      if (headerImagePreviewUrl) URL.revokeObjectURL(headerImagePreviewUrl);
    };
  }, [headerImagePreviewUrl]);

  const previewButtons = [button1Text, button2Text].filter((t) => t.trim()).map((text) => ({ text: text.trim() }));

  if (state.done) {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-ink">Plantilla enviada a revisión</h2>
          <p className="text-sm text-ink-muted">
            Meta la revisa y aprueba (o rechaza) — puede tardar desde minutos hasta 1-2 días. Usa "↻ Revisar estado"
            en la tarjeta para ver cuándo cambia.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-6">
      <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between gap-3 bg-surface px-6 py-3">
        <h2 className="text-lg font-bold text-ink">Nueva plantilla</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex-none rounded-md p-1 text-ink-muted transition hover:bg-background hover:text-ink"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-ink-muted">
        Por ahora solo texto fijo (sin variables como {"{{1}}"}) — el mismo mensaje le llega a todos los
        destinatarios de la difusión.
      </p>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Nombre interno
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="promo_octubre"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
            <p className="text-[11px] text-ink-faint">Solo minúsculas y guiones bajos — Meta lo exige así.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="language" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
                Idioma
              </label>
              <select
                id="language"
                name="language"
                defaultValue="es"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="category" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
                Categoría
              </label>
              <select
                id="category"
                name="category"
                defaultValue="MARKETING"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
              >
                <option value="MARKETING">Marketing / promoción</option>
                <option value="UTILITY">Informativa (no promocional)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="bodyText" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Mensaje
            </label>
            <textarea
              id="bodyText"
              name="bodyText"
              required
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hola, tenemos una promoción especial esta semana..."
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="headerImage" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Imagen de encabezado (opcional)
            </label>
            <p className="text-[11px] text-ink-faint">
              Aparece arriba del mensaje, igual que en Kommo — no es obligatoria.
            </p>
            <input
              id="headerImage"
              name="headerImage"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setHeaderImagePreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return file ? URL.createObjectURL(file) : null;
                });
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none file:mr-3 file:rounded file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Botones de llamado a la acción (opcional, hasta 2)
            </label>
            {[1, 2].map((n) => (
              <div key={n} className="grid grid-cols-2 gap-2">
                <input
                  name={`button${n}Text`}
                  value={n === 1 ? button1Text : button2Text}
                  onChange={(e) => (n === 1 ? setButton1Text : setButton2Text)(e.target.value)}
                  placeholder={n === 1 ? "Ver oferta" : "Agenda tu cita"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <input
                  name={`button${n}Url`}
                  type="url"
                  placeholder="https://tu-sitio.com/..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </div>
            ))}
            <p className="text-[11px] text-ink-faint">
              Cada botón abre ese enlace cuando el cliente lo toca en WhatsApp. Llena texto y enlace juntos, o deja
              ambos vacíos para no usar ese botón.
            </p>
          </div>
        </div>

        <TemplateMessagePreview
          headerImageUrl={headerImagePreviewUrl}
          bodyText={bodyText}
          buttons={previewButtons}
        />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Enviando..." : "Enviar a Meta para revisión"}
        </button>
      </div>
    </form>
  );
}
