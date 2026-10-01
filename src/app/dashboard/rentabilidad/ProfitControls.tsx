"use client";

import { useState, useTransition } from "react";
import { setAccountMonthlyPrice, setAgentModel } from "@/lib/profitabilityActions";
import { AGENT_MODELS } from "@/lib/plans";

/** Inline "what this client really pays" editor; empty = plan list price. */
export function PriceCell({ userId, customPrice, listPrice }: { userId: string; customPrice: number | null; listPrice: number }) {
  const [value, setValue] = useState(customPrice === null ? "" : String(customPrice));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (next === (customPrice ?? null)) return;
    startTransition(async () => {
      const result = await setAccountMonthlyPrice(userId, next);
      if (result.ok) {
        setError(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-w-[7rem]">
      <label className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 focus-within:border-accent">
        <span className="text-ink-faint">$</span>
        <input
          inputMode="decimal"
          value={value}
          placeholder={String(listPrice)}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          disabled={isPending}
          aria-label="Precio mensual que paga este cliente (USD)"
          className="w-16 bg-transparent text-sm tabular-nums text-ink outline-none placeholder:text-ink-faint"
        />
        <span className="text-xs text-ink-faint">{saved ? "✓" : "/mes"}</span>
      </label>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

export function ModelSelect({ businessId, model }: { businessId: string; model: string }) {
  const [current, setCurrent] = useState(model);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const known = AGENT_MODELS.some((m) => m.id === current);

  return (
    <div>
      <select
        value={current}
        disabled={isPending}
        aria-label="Modelo de IA de esta línea"
        onChange={(e) => {
          const next = e.target.value;
          const previous = current;
          setCurrent(next);
          startTransition(async () => {
            const result = await setAgentModel(businessId, next);
            if (!result.ok) {
              setCurrent(previous);
              setError(result.error);
            } else {
              setError(null);
            }
          });
        }}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-ink outline-none focus:border-accent disabled:opacity-60"
      >
        {!known && <option value={current}>{current}</option>}
        {AGENT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
