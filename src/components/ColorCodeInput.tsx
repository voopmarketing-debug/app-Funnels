"use client";

import { useEffect, useState } from "react";
import { parseColorInput } from "@/lib/colorInput";

/**
 * The text half of a color field: type or paste the code (#hex, rgb(...))
 * Calls onChange only with a valid #rrggbb.
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect picker / palette changes
    setText(value ?? "");
    setInvalid(false);
  }, [value]);

  function commit(raw: string) {
    const hex = parseColorInput(raw);
    if (hex) {
      setInvalid(false);
      onChange(hex);
    } else {
      setInvalid(raw.trim() !== "");
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
    </div>
  );
}
