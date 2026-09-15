"use client";

import { useRouter, usePathname } from "next/navigation";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/dateRanges";

export function DateRangeSelector({ value }: { value: DateRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={value}
      onChange={(e) => router.push(`${pathname}?range=${e.target.value}`)}
      className="fl-mono rounded-md border border-border bg-surface px-2 py-1.5 text-xs uppercase tracking-wide text-ink outline-none focus:border-accent"
    >
      {DATE_RANGE_OPTIONS.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
