"use client";

import { useActionState, useState } from "react";
import { updateAgent } from "@/lib/actions";

type SaveState = { saved: boolean };

export function AgentForm({
  businessId,
  systemPrompt,
  enabled,
  temperature,
}: {
  businessId: string;
  systemPrompt: string;
  enabled: boolean;
  temperature: number;
}) {
  const [temperatureValue, setTemperatureValue] = useState(temperature);
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

      <div className="flex items-center gap-2">
        <input
          id="enabled"
          name="enabled"
          type="checkbox"
          defaultChecked={enabled}
          className="accent-[var(--accent)]"
        />
        <label htmlFor="enabled" className="text-sm">
          Agente activo
        </label>
      </div>

      <div className="space-y-1">
        <label htmlFor="temperature" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Temperatura ({temperatureValue})
        </label>
        <input
          id="temperature"
          name="temperature"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperatureValue}
          onChange={(e) => setTemperatureValue(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
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
