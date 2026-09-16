"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessSubscription } from "@/lib/actions";

type SubscriptionStatus = "active" | "expiring" | "expired" | "unset";

const STATUS_STYLES: Record<Exclude<SubscriptionStatus, "unset">, { dot: string; text: string; label: string }> = {
  active: { dot: "#0ca30c", text: "#0ca30c", label: "Activa" },
  expiring: { dot: "#fab219", text: "#fab219", label: "Por vencer" },
  expired: { dot: "#d03b3b", text: "#d03b3b", label: "Vencida" },
};

// Converts a Date to the yyyy-mm-dd string <input type="date"> needs, in
// local time (not toISOString, which shifts by the UTC offset and can show
// the wrong day) — this is a display date, not a timestamp.
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function SubscriptionDatesEditor({
  businessId,
  startedAt,
  endsAt,
  status,
}: {
  businessId: string;
  startedAt: Date | null;
  endsAt: Date | null;
  status: SubscriptionStatus;
}) {
  const router = useRouter();
  const [start, setStart] = useState(toDateInputValue(startedAt));
  const [end, setEnd] = useState(toDateInputValue(endsAt));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = start !== toDateInputValue(startedAt) || end !== toDateInputValue(endsAt);
  const style = status !== "unset" ? STATUS_STYLES[status] : null;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBusinessSubscription(businessId, { startedAt: start || null, endsAt: end || null });
        router.refresh();
      } catch {
        setError("No se pudo guardar");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Inicio de membresía"
          className="fl-mono w-[8.5rem] rounded border border-border bg-background px-1.5 py-1 text-[11px] text-ink outline-none focus:border-accent"
        />
        <span className="text-ink-faint">→</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="Vence"
          className="fl-mono w-[8.5rem] rounded border border-border bg-background px-1.5 py-1 text-[11px] text-ink outline-none focus:border-accent"
        />
      </div>
      <div className="flex items-center gap-2">
        {style && (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: style.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
            {style.label}
          </span>
        )}
        {dirty && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        )}
        {error && <span className="text-[11px] text-error">{error}</span>}
      </div>
    </div>
  );
}
