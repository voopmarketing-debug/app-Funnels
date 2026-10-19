"use client";

import type { ReactNode } from "react";

/**
 * Wrapper that follows the pointer: every .lp-card inside gets the cursor
 * position as --mx/--my, which the CSS turns into a soft glow under the mouse.
 */
export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>(".lp-card");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
