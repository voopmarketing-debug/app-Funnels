"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "board", label: "Tablero" },
  { key: "list", label: "Lista" },
  { key: "chat", label: "Conversaciones" },
] as const;

export function CrmTabs({ activeTab }: { activeTab: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "board" ? pathname : `${pathname}?tab=${tab.key}`}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            activeTab === tab.key ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
