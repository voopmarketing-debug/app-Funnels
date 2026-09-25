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
    <div className="flex items-center gap-2">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        const Icon = tab.icon;
        const query = tab.key === "chat" ? suffix : [`tab=${tab.key}`, suffix].filter(Boolean).join("&");
        return (
          <Link
            key={tab.key}
            href={query ? `${pathname}?${query}` : pathname}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition"
            style={
              active
                ? {
                    borderColor: `rgba(var(${tab.glowVar}), 0.4)`,
                    background: `rgba(var(${tab.glowVar}), 0.16)`,
                    color: `rgba(var(${tab.glowVar}), 1)`,
                  }
                : { borderColor: "var(--border)", color: "var(--ink-muted)" }
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
