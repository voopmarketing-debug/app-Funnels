"use client";

import { useActionState, useRef } from "react";
import { AGENT_PROMPT_TEMPLATE } from "@/lib/promptTemplate";
import { updateAgent } from "@/lib/actions";
import { TONE_OPTIONS, LENGTH_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/agentOptions";

type SaveState = { saved: boolean };

export function AgentForm({
  businessId,
  systemPrompt,
  tone,
  replyLength,
  industry,
}: {
  businessId: string;
  systemPrompt: string;
  tone: string;
  replyLength: string;
  industry: string;
}) {
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    async (_prevState, formData) => {
      await updateAgent(businessId, formData);
      return { saved: true };
    },
    { saved: false },
  );
  const promptRef = useRef<HTMLTextAreaElement>(null);

  function applyTemplate() {
    const el = promptRef.current;
    if (!el) return;
    if (el.value.trim() && !confirm("Esto reemplaza las instrucciones actuales por la plantilla maestra (aún no se guarda). ¿Continuar?")) return;
    el.value = AGENT_PROMPT_TEMPLATE;
    el.focus();
    el.setSelectionRange(0, 0);
    el.scrollTop = 0;
  }

  return (
    <div className="space-y-4">

      <form action={formAction} className="mt-4 space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">Reemplaza cada [ ... ] con la información real de tu negocio y borra lo que no aplique.</p>
          <button
            type="button"
            onClick={applyTemplate}
            className="rounded-md border border-border-strong px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            📋 Usar plantilla maestra
          </button>
        </div>
        <textarea
          ref={promptRef}
          id="systemPrompt"
          name="systemPrompt"
          aria-label="Instrucciones del agente de IA"
          defaultValue={systemPrompt}
          placeholder="Pega aquí las instrucciones de tu negocio para el agente..."
          rows={8}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <label htmlFor="industry" className="fl-mono block truncate text-[12px] tracking-wide text-ink-muted uppercase">
            Tipo de negocio
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue={industry}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 space-y-1">
          <label htmlFor="tone" className="fl-mono block truncate text-[12px] tracking-wide text-ink-muted uppercase">
            Tono del agente
          </label>
          <select
            id="tone"
            name="tone"
            defaultValue={tone}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 space-y-1">
          <label htmlFor="replyLength" className="fl-mono block truncate text-[12px] tracking-wide text-ink-muted uppercase">
            Largo de respuestas
          </label>
          <select
            id="replyLength"
            name="replyLength"
            defaultValue={replyLength}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            {LENGTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        {state.saved && !isPending && (
          <span className="fl-mono text-xs text-accent">✓ Guardado</span>
        )}
      </div>
      </form>
    </div>
  );
}
