"use client";

import { useEffect, useRef, useState } from "react";

/** A small ⓘ that opens the longer explanation of a metric (tap or click). */
export function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Qué significa ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-2 hover:text-ink"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 9v4.5M10 6.5v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-6 z-20 w-64 max-w-[80vw] rounded-lg border border-border-strong bg-surface-2 p-3 text-xs leading-relaxed text-ink shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}
