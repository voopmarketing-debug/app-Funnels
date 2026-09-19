"use client";

import { useActionState, useRef, useState } from "react";
import { sendBroadcast, type BroadcastResult } from "@/lib/actions";

type DialogState = { error: string | null; result: BroadcastResult | null };
const INITIAL_STATE: DialogState = { error: null, result: null };

// Entry point for mass-messaging: opens a dialog to pick a pipeline stage
// (or all of it) and compose one message sent to every matching contact.
type BroadcastTemplate = { id: string; name: string; bodyText: string };

export function BroadcastDialog({
  businessId,
  stages,
  templates,
}: {
  businessId: string;
  stages: { id: string; name: string }[];
  templates: BroadcastTemplate[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
      >
        📢 Difusión
      </button>

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-md p-0">
        <BroadcastDialogContent
          key={formKey}
          businessId={businessId}
          stages={stages}
          templates={templates}
          onClose={() => dialogRef.current?.close()}
        />
      </dialog>
    </>
  );
}

function BroadcastDialogContent({
  businessId,
  stages,
  templates,
  onClose,
}: {
  businessId: string;
  stages: { id: string; name: string }[];
  templates: BroadcastTemplate[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"free" | "template">("free");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id);
  const [state, formAction, isPending] = useActionState<DialogState, FormData>(async (_prev, formData) => {
    try {
      const result = await sendBroadcast(businessId, formData);
      return { error: null, result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo enviar la difusión", result: null };
    }
  }, INITIAL_STATE);

  if (state.result) {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-ink">Difusión enviada</h2>
          <p className="text-sm text-ink-muted">
            {state.result.sentCount} de {state.result.totalRecipients} mensajes entregados.
            {state.result.failedCount > 0 && (
              <>
                {" "}
                {state.result.failedCount} no se pudieron enviar — lo más probable es que esos contactos llevan más
                de 24 horas sin escribirte (regla de WhatsApp: solo deja mandar mensajes libres dentro de esa
                ventana).
              </>
            )}
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
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">Mensaje de difusión</h2>
        <p className="text-sm text-ink-muted">
          Se envía a todos los contactos de la etapa que elijas, o de todo el pipeline. WhatsApp solo permite
          mensajes libres a quien te escribió en las últimas 24 horas — a los demás puede que no les llegue.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="stageId" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Destinatarios
        </label>
        <select
          id="stageId"
          name="stageId"
          defaultValue="all"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        >
          <option value="all">Todo el pipeline</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <span className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Tipo de envío</span>
        <div className="flex gap-1 rounded-md border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setMode("free")}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
              mode === "free" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            Mensaje libre
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
              mode === "template" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            Plantilla aprobada
          </button>
        </div>
        <p className="text-[11px] text-ink-faint">
          {mode === "free"
            ? "Solo les llega a quienes te escribieron en las últimas 24 horas."
            : "Le llega a todos, incluso contactos fríos — pero el texto es fijo, no se puede editar aquí."}
        </p>
      </div>

      {mode === "free" ? (
        <div className="space-y-1">
          <label htmlFor="message" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Mensaje
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            placeholder="Escribe el mensaje que van a recibir..."
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>
      ) : templates.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted">
          Todavía no tienes plantillas aprobadas por Meta. Créalas y espera su aprobación en{" "}
          <span className="fl-mono text-ink">Plantillas</span> (en la página del negocio).
        </p>
      ) : (
        <div className="space-y-1">
          <label htmlFor="templateId" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Plantilla
          </label>
          <select
            id="templateId"
            name="templateId"
            required
            defaultValue={templates[0].id}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-ink-muted">
            {templates.find((t) => t.id === selectedTemplateId)?.bodyText ?? templates[0].bodyText}
          </p>
        </div>
      )}

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
          {isPending ? "Enviando..." : "Enviar difusión"}
        </button>
      </div>
    </form>
  );
}
