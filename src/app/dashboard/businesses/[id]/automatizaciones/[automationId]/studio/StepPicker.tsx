"use client";

import { useEffect, useRef } from "react";
import type { StepType } from "@/lib/automations/flow";
import { StepIcon } from "../../StepIcon";
import { MENU_ORDER, STEP_META } from "../../stepMeta";

// The menu of steps that opens where you dropped an arrow or pressed "+".

const WIDTH = 300;

export function StepPicker({ x, y, onPick, onClose, disabled }: { x: number; y: number; onPick: (type: StepType) => void; onClose: () => void; disabled?: StepType[] }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Wait a beat so the click that opened the menu doesn't close it.
    const id = setTimeout(() => document.addEventListener("mousedown", outside), 0);
    document.addEventListener("keydown", escape);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  const margin = 8;
  const maxHeight = Math.min(480, window.innerHeight - margin * 2);
  const left = Math.min(Math.max(margin, x + 12), window.innerWidth - WIDTH - margin);
  const top = Math.min(Math.max(margin, y - 24), window.innerHeight - maxHeight - margin);

  return (
    <div ref={box} role="menu" aria-label="Agrega el siguiente paso" style={{ position: "fixed", left, top, width: WIDTH, maxHeight }} className="z-[90] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-2 shadow-2xl">
      <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Agrega el siguiente paso</p>
      <ul>
        {MENU_ORDER.map((type) => {
          const off = disabled?.includes(type);
          return (
            <li key={type}>
              <button
                type="button"
                role="menuitem"
                disabled={off}
                onClick={() => onPick(type)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <StepIcon type={type} size={32} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{STEP_META[type].label}</span>
                  <span className="block text-xs leading-snug text-ink-muted">{off ? "Este paso termina el flujo: va solo al final de un camino." : STEP_META[type].hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
