"use client";

import type { ReactNode } from "react";

// Small building blocks for the "Conectar WhatsApp" dialog: a numbered path
// the person can follow without knowing Meta's vocabulary. Plain words first,
// Meta's own button names in a highlighted chip so they are easy to spot.

// WhatsApp's own brand green, as in the status card.
export const WHATSAPP_GREEN = "37, 211, 102";

/** A button or menu name exactly as Meta shows it. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-block rounded-md border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold whitespace-nowrap text-ink">{children}</span>;
}

/** A link that opens Meta (or any other site) in a new tab. */
export function OpenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-[13px] font-semibold text-ink transition hover:border-accent hover:text-accent"
    >
      {children}
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M7 13 13 7M8 7h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

const CALLOUT_TONES = {
  info: { icon: "i", box: "border-border bg-surface-2/70", mark: "bg-ink/10 text-ink" },
  tip: { icon: "✓", box: "border-accent/40 bg-accent/10", mark: "bg-accent text-accent-ink" },
  warn: { icon: "!", box: "border-amber-500/50 bg-amber-500/10", mark: "bg-amber-500 text-black" },
} as const;

export function Callout({ tone = "info", title, children }: { tone?: keyof typeof CALLOUT_TONES; title?: string; children: ReactNode }) {
  const t = CALLOUT_TONES[tone];
  return (
    <div className={`flex gap-3 rounded-xl border p-3 text-[13px] leading-relaxed text-ink-muted ${t.box}`}>
      <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${t.mark}`} aria-hidden="true">
        {t.icon}
      </span>
      <div className="min-w-0">
        {title && <p className="mb-0.5 text-sm font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** The numbered path: a vertical line joins the steps so it reads as one route. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-0">{children}</ol>;
}

export function Step({
  n,
  title,
  time,
  done = false,
  last = false,
  children,
}: {
  n: number;
  title: string;
  /** "1 min", "2 min"… so the person knows how long it takes. */
  time?: string;
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!last && <span className={`absolute top-8 bottom-0 left-[15px] w-0.5 rounded-full ${done ? "bg-accent/60" : "bg-border"}`} aria-hidden="true" />}
      <span
        className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${done ? "bg-accent text-accent-ink" : "border-2 border-accent/70 bg-surface text-accent"}`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-ink">
          <span className="sr-only">Paso {n}: </span>
          {title}
          {time && <span className="text-xs font-medium text-ink-faint">· {time}</span>}
        </h3>
        {children}
      </div>
    </li>
  );
}

/** What the person will see on Meta's screens, in order. */
export function Screens({ items }: { items: { title: string; text: ReactNode }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-ink/10 text-xs font-bold text-ink" aria-hidden="true">
            {String.fromCharCode(97 + i)}
          </span>
          <div className="min-w-0 text-[13px] leading-relaxed text-ink-muted">
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            {item.text}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Things to have ready; ticking them is only for the person's own peace of mind. */
export function Checklist({ items, checked, onToggle, idPrefix }: { items: { key: string; label: ReactNode }[]; checked: Record<string, boolean>; onToggle: (key: string) => void; idPrefix: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const on = Boolean(checked[item.key]);
        const id = `${idPrefix}-${item.key}`;
        return (
          <li key={item.key}>
            <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-[13px] leading-relaxed transition ${on ? "border-accent/50 bg-accent/10 text-ink" : "border-border text-ink-muted hover:border-border-strong"}`}>
              <input id={id} type="checkbox" checked={on} onChange={() => onToggle(item.key)} className="mt-0.5 h-4 w-4 flex-none accent-accent" />
              <span>{item.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** One thing that can go wrong and what to do. */
export function Trouble({ problem, fix }: { problem: string; fix: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3 text-[13px] leading-relaxed text-ink-muted">
      <p className="font-semibold text-ink">{problem}</p>
      <div className="mt-0.5">{fix}</div>
    </div>
  );
}

export function WhatsAppGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.08.9.92-3-.2-.31a8.2 8.2 0 1 1 6.86 3.74Zm4.5-6.1c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.17.25-.64.8-.78.97-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-3.3-2.9c-.25-.43.25-.4.72-1.33.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74 1.57.68 2.18.74 2.97.62.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.17-.48-.29Z" />
    </svg>
  );
}
