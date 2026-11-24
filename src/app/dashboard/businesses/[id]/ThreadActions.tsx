"use client";

import { useState, type ReactNode } from "react";

/**
 * The secondary actions of a chat (template, stage, sale, contact). On a phone they sit behind a
 * "⋯" button so the conversation gets the screen; from md up they are always shown in the header.
 * The button and the row are siblings so the header can lay them out itself.
 */
export function ThreadActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Ocultar las opciones del chat" : "Más opciones del chat"}
        className={`order-3 flex h-11 w-11 flex-none items-center justify-center rounded-lg border text-xl leading-none md:hidden ${open ? "border-accent bg-accent/15 text-accent" : "border-border text-ink-muted"}`}
      >
        ⋯
      </button>
      <div className={`${open ? "flex" : "hidden"} order-5 w-full items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:order-none md:flex md:w-auto md:flex-none md:overflow-visible md:pb-0`}>{children}</div>
    </>
  );
}
