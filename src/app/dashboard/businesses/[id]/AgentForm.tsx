"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="systemPrompt" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Instrucciones del agente de IA
        </label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          defaultValue={systemPrompt}
          rows={8}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="industry" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Tipo de negocio
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue={industry}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="tone" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Tono del agente
          </label>
          <select
            id="tone"
            name="tone"
            defaultValue={tone}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="replyLength" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Largo de las respuestas
          </label>
          <select
            id="replyLength"
            name="replyLength"
            defaultValue={replyLength}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
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
  );
}
