"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ColorCodeInput } from "@/components/ColorCodeInput";

// Ready-to-tap colors, grouped by family: neutrals, warm, green, blue, violet and pink, earth.
const PALETTE = [
  "#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#f3f4f6", "#ffffff", "#0f172a",
  "#7f1d1d", "#b91c1c", "#dc2626", "#ef4444", "#ea580c", "#f97316", "#f59e0b", "#eab308",
  "#365314", "#4d7c0f", "#65a30d", "#84cc16", "#16a34a", "#22c55e", "#15803d", "#166534",
  "#0f766e", "#0d9488", "#14b8a6", "#0891b2", "#0ea5e9", "#2563eb", "#1d4ed8", "#1e3a8a",
  "#4338ca", "#6366f1", "#7c3aed", "#9333ea", "#c026d3", "#db2777", "#e11d48", "#be123c",
  "#78350f", "#92400e", "#a16207", "#b45309", "#854d0e", "#0b1b3a", "#2d1b4e", "#064e3b",
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const CHECKERED = "repeating-linear-gradient(45deg,#ddd,#ddd 4px,#fff 4px,#fff 8px)";

/**
 * A color swatch that opens a palette: a grid of ready colors, suggestions for the business, the
 * code field (type, paste, eyedropper) and the browser's own picker as the last resort. The
 * browser's picker alone showed nothing on some browsers, so it is no longer the only way.
 */
export function ColorSwatchButton({
  value,
  onChange,
  onClear,
  label,
  disabled = false,
  suggestions = [],
  sizeClass = "h-8 w-8",
  roundedClass = "rounded-md",
  children,
}: {
  value: string | null;
  onChange: (hex: string) => void;
  /** When given, the palette offers "Quitar color". */
  onClear?: () => void;
  label: string;
  disabled?: boolean;
  /** Colors recommended for this business, shown first. */
  suggestions?: string[];
  sizeClass?: string;
  roundedClass?: string;
  /** Drawn over the swatch (for example a pencil badge). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = value && HEX.test(value) ? value.toLowerCase() : null;
  const suggested = Array.from(new Set(suggestions.filter((c) => HEX.test(c)).map((c) => c.toLowerCase()))).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(hex: string) {
    onChange(hex);
    setOpen(false);
  }

  const swatch = (hex: string) => {
    const selected = current === hex.toLowerCase();
    return (
      <button
        key={hex}
        type="button"
        onClick={() => pick(hex)}
        aria-label={`Elegir ${hex}`}
        aria-pressed={selected}
        title={hex}
        className={`h-8 w-full rounded-md border border-black/15 transition hover:scale-110 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
        style={{ background: hex }}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Elegir ${label}`}
        title={`Elegir ${label}`}
        className={`relative flex-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass}`}
      >
        <span className={`block h-full w-full border border-black/10 shadow-inner ${roundedClass}`} style={{ background: current ?? CHECKERED }} />
        {children}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={`Elegir ${label}`}
              className="max-h-[88dvh] w-full max-w-sm space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 text-ink shadow-2xl outline-none sm:rounded-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-10 w-10 flex-none rounded-lg border border-black/10" style={{ background: current ?? CHECKERED }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">Elige {label}</p>
                    <p className="font-mono text-xs uppercase text-ink-muted">{current ?? "Sin color"}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-border text-lg leading-none hover:border-accent">
                  ×
                </button>
              </div>

              {suggested.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Sugeridos para tu negocio</p>
                  <div className="grid grid-cols-8 gap-2">{suggested.map(swatch)}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Paleta</p>
                <div className="grid grid-cols-8 gap-2">{PALETTE.map(swatch)}</div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Otro color</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ColorCodeInput value={current} label={label} onChange={(hex) => onChange(hex)} />
                  <label className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-ink-muted hover:border-accent hover:text-ink">
                    Más colores
                    <input
                      type="color"
                      value={current ?? "#3457ff"}
                      onChange={(e) => onChange(e.target.value)}
                      aria-label="Abrir el selector de colores del navegador"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                {onClear && current ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    className="text-xs font-semibold text-ink-muted underline hover:text-ink"
                  >
                    Quitar color
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                  Listo
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
