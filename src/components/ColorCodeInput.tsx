"use client";

import { useEffect, useState } from "react";
import { parseColorInput } from "@/lib/colorInput";

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * The text half of a color field: type or paste the code (#hex, rgb(...))
 * and, where the browser supports it, pick a color from anywhere on screen
 * with the eyedropper. Calls onChange only with a valid #rrggbb.
 */
export function ColorCodeInput({
  value,
  onChange,
  disabled = false,
  label,
  className = "",
}: {
  value: string | null;
  onChange: (hex: string) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);
  const [canPick, setCanPick] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect picker / palette changes
    setText(value ?? "");
    setInvalid(false);
  }, [value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature check after mount
    setCanPick(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  function commit(raw: string) {
    const hex = parseColorInput(raw);
    if (hex) {
      setInvalid(false);
      onChange(hex);
    } else {
      setInvalid(raw.trim() !== "");
    }
  }

  async function pick() {
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const { sRGBHex } = await new Ctor().open();
      const hex = parseColorInput(sRGBHex);
      if (hex) onChange(hex);
    } catch {
      // Cancelled with Esc.
    }
  }

  return (
    <div className={`flex flex-none items-center gap-1 ${className}`}>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (parseColorInput(e.target.value)) commit(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (parseColorInput(pasted)) {
            e.preventDefault();
            setText(pasted.trim());
            commit(pasted);
          }
        }}
        disabled={disabled}
        placeholder="#000000"
        spellCheck={false}
        aria-label={`Código del ${label}`}
        aria-invalid={invalid}
        title="Escribe o pega el código: #F3F3EF o rgb(243, 243, 239)"
        className={`w-[6.25rem] rounded-md border bg-surface px-2 py-1.5 font-mono text-xs uppercase text-ink outline-none focus:border-accent disabled:opacity-50 ${
          invalid ? "border-error" : "border-border"
        }`}
      />
      {canPick && (
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          title="Tomar un color de la pantalla"
          aria-label={`Tomar el ${label} de la pantalla`}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="m11.5 5.5 3 3M4 16l1-3 7.5-7.5 2 2L7 15l-3 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m12.5 4.5 1.3-1.3a1.4 1.4 0 0 1 2 2L14.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
