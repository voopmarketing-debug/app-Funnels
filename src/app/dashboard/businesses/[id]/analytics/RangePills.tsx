"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { DateRangeKey } from "@/lib/dateRanges";

const PILLS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "15d", label: "15 días" },
  { key: "30d", label: "Mes" },
];

/** Segmented Hoy · Ayer · 7 días · 15 días · Mes filter, kept in ?range=. */
export function RangePills({ value }: { value: DateRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="Periodo"
      className={`inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 [scrollbar-width:none] ${isPending ? "opacity-70" : ""}`}
    >
      {PILLS.map((pill) => {
        const active = pill.key === value;
        return (
          <button
            key={pill.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => startTransition(() => router.push(`${pathname}?range=${pill.key}`, { scroll: false }))}
            className={`flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              active ? "bg-accent text-accent-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
