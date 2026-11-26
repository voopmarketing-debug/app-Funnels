"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";
import type { TemplateCard } from "@/lib/websiteNicheTemplates";
import { TemplateLibrary } from "./TemplateLibrary";
import { WebsitePagesList } from "./WebsitePagesList";
import type { CreationStudio } from "./crear/CreationStudio";

type Tab = "plantillas" | "sitios";

/**
 * The first screen of "Sitio web": the template library, with "Mis sitios" one tab away.
 */
export function WebsiteHome({
  businessId,
  businessName,
  initialTab,
  cards,
  pagesList,
  studio,
}: {
  businessId: string;
  businessName: string;
  initialTab: Tab;
  cards: TemplateCard[];
  pagesList: Omit<ComponentProps<typeof WebsitePagesList>, "onNewPage">;
  studio: ComponentProps<typeof CreationStudio>;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const count = pagesList.pages.length;
  const tabs: [Tab, string, string, string][] = [
    ["plantillas", "📄", "Plantillas", "Plantillas"],
    ["sitios", "🌐", count > 0 ? `Mis sitios (${count})` : "Mis sitios", count > 0 ? `Sitios (${count})` : "Sitios"],
  ];
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/dashboard/businesses/${businessId}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {businessName}
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Sitio web</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">Elige una plantilla lista para tu tipo de negocio, mírala y publícala. Después la editas como quieras.</p>
          </div>
          <div className="fl-seg flex w-full sm:inline-flex sm:w-auto" role="radiogroup" aria-label="Sección">
            {tabs.map(([key, icon, label, short]) => (
              <button key={key} type="button" role="radio" aria-checked={tab === key} onClick={() => setTab(key)} className="fl-seg-item flex-1 whitespace-nowrap px-2 py-2 text-sm sm:flex-none sm:px-4">
                <span className="hidden sm:inline">{icon} </span>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "plantillas" && <TemplateLibrary businessId={businessId} cards={cards} needsWhatsapp={!!studio.needsWhatsapp} />}
      {tab === "sitios" && <WebsitePagesList {...pagesList} onNewPage={() => setTab("plantillas")} />}
    </div>
  );
}
