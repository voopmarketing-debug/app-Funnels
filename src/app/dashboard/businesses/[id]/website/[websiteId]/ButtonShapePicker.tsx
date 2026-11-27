"use client";

export const BTN_SHAPE_OPTIONS: { value: "square" | "soft" | "round" | null; label: string; radius: string }[] = [
  { value: null, label: "Automática", radius: "" },
  { value: "square", label: "Cuadrados", radius: "0" },
  { value: "soft", label: "Semi cuadrados", radius: "6px" },
  { value: "round", label: "Redondos", radius: "999px" },
];

/** Shape of the buttons: drawn as small buttons (auto, square, slightly rounded, pill). */
export function ButtonShapePicker({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: "square" | "soft" | "round" | null) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {BTN_SHAPE_OPTIONS.map((o) => {
          const on = (value ?? null) === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.value)}
              className={`flex h-10 w-16 items-center justify-center rounded-md border transition ${on ? "border-accent bg-accent/15" : "border-border hover:border-border-strong"}`}
            >
              {o.value === null ? (
                <span className="text-[10px] font-bold text-ink-muted">Auto</span>
              ) : (
                <span aria-hidden="true" style={{ borderRadius: o.radius }} className={`block h-5 w-10 ${on ? "bg-accent" : "bg-ink-faint/60"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
