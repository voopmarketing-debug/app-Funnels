"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatIcon, LayersIcon, ListIcon, BroadcastIcon } from "../analytics/StatIcons";

// Conversaciones first — it's what an agency actually opens CRM for day to
// day; Tablero and Lista are the less-frequent "manage the whole pipeline"
// views. "chat" is also the default tab (see crm/page.tsx), so its link is
// the bare pathname — the rest carry the ?tab= param instead.
const TABS = [
  { key: "chat", label: "Conversaciones", icon: ChatIcon, glowVar: "--glow-accent" },
  { key: "board", label: "Tablero", icon: LayersIcon, glowVar: "--glow-secondary" },
  { key: "list", label: "Lista", icon: ListIcon, glowVar: "--glow-blue" },
  { key: "broadcasts", label: "Difusiones", icon: BroadcastIcon, glowVar: "--glow-amber" },
] as const;

export function CrmTabs({ activeTab }: { activeTab: string }) {
  const pathname = usePathname();
  // Keeps the selected embudo (?pipeline=) intact when switching tabs — only
  // ?tab and ?conv are tab-specific.
  const pipelineParam = useSearchParams().get("pipeline");
  const suffix = pipelineParam ? `pipeline=${pipelineParam}` : "";

  return (
    // Scrolls sideways on narrow screens instead of pushing the whole page
    // wider than the viewport (which made every other element shift/cut off).
    <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] md:overflow-visible">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        const Icon = tab.icon;
        const query = tab.key === "chat" ? suffix : [`tab=${tab.key}`, suffix].filter(Boolean).join("&");
        return (
          <Link
            key={tab.key}
            href={query ? `${pathname}?${query}` : pathname}
            aria-current={active ? "page" : undefined}
            className="flex flex-none items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition hover:-translate-y-px"
            style={
              active
                ? {
                    borderColor: `rgba(var(${tab.glowVar}), 0.5)`,
                    background: `linear-gradient(180deg, rgba(var(${tab.glowVar}), 0.24), rgba(var(${tab.glowVar}), 0.1))`,
                    color: `rgba(var(${tab.glowVar}), 1)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 16px -8px rgba(var(${tab.glowVar}), 0.7)`,
                    transform: "translateY(-1px)",
                  }
                : {
                    borderColor: "var(--border)",
                    color: "var(--ink-muted)",
                    background: "linear-gradient(180deg, var(--surface), var(--surface-2))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 var(--border-strong)",
                  }
            }
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
