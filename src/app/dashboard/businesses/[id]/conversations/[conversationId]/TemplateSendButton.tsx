"use client";

import { useActionState, useRef, useState } from "react";
import { sendTemplateMessage } from "@/lib/actions";

type SendState = { sentCount: number; error: string | null };
const INITIAL_STATE: SendState = { sentCount: 0, error: null };

type Template = { id: string; name: string; bodyText: string };

// Lets a business owner reopen or kick off a conversation with an
// approved WhatsApp template — the only way to reach a customer once
// Meta's 24h free-form window has closed, and available from any chat
// (not just closed ones) so it doubles as a quick "start a new topic"
// opener, same idea as Kommo's plantillas activadoras.
export function TemplateSendButton({
  businessId,
  conversationId,
  templates,
  windowOpen,
}: {
  businessId: string;
  conversationId: string;
  templates: Template[];
  windowOpen: boolean;
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
        title={
          windowOpen
            ? "Enviar una plantilla aprobada"
            : "Han pasado más de 24h desde el último mensaje del cliente — usa una plantilla para reabrir la conversación"
        }
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
          windowOpen
            ? "border-border-strong text-ink-muted hover:border-accent hover:text-accent"
            : "animate-pulse border-accent bg-accent/10 text-accent"
        }`}
      >
        📋 Plantilla
      </button>

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-md p-0">
        <TemplateDialogContent
          key={formKey}
          businessId={businessId}
          conversationId={conversationId}
          templates={templates}
          windowOpen={windowOpen}
          onClose={() => dialogRef.current?.close()}
        />
      </dialog>
    </>
  );
}

function TemplateDialogContent({
  businessId,
  conversationId,
  templates,
  windowOpen,
  onClose,
}: {
  businessId: string;
  conversationId: string;
  templates: Template[];
  windowOpen: boolean;
  onClose: () => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id);
  const [state, formAction, isPending] = useActionState<SendState, FormData>(async (prevState, formData) => {
    try {
      await sendTemplateMessage(businessId, conversationId, formData);
      return { sentCount: prevState.sentCount + 1, error: null };
    } catch (err) {
      return {
        sentCount: prevState.sentCount,
        error: err instanceof Error ? err.message : "No se pudo enviar la plantilla",
      };
    }
  }, INITIAL_STATE);

  if (state.sentCount > 0 && !state.error) {
    return (
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-bold text-ink">Plantilla enviada</h2>
        <p className="text-sm text-ink-muted">El mensaje ya salió por WhatsApp y quedó registrado en el chat.</p>
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
        <h2 className="text-lg font-bold text-ink">Enviar plantilla</h2>
        <p className="text-sm text-ink-muted">
          {windowOpen
            ? "Le llega igual a un mensaje libre, pero con texto fijo — útil para abrir un tema nuevo."
            : "Ya pasaron más de 24h desde el último mensaje del cliente: WhatsApp solo deja reabrir la conversación con una plantilla aprobada por Meta."}
        </p>
      </div>

      {templates.length === 0 ? (
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
        {templates.length > 0 && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? "Enviando..." : "Enviar plantilla"}
          </button>
        )}
      </div>
    </form>
  );
}
