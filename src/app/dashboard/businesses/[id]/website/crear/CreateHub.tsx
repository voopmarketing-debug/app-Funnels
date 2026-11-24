"use client";

import { useState, type ComponentProps } from "react";
import { CreationStudio } from "./CreationStudio";
import { TemplateGallery } from "./TemplateGallery";

type Tab = "plantillas" | "ia";

/**
 * Where a new page starts: ready-made templates for the kinds of business we serve first, and
 * "Crear con IA" second. The AI chat is only opened when chosen (it reads the business with the
 * AI as soon as it opens), unless a conversation was already in progress.
 */
export function CreateHub({ hasDraft, ...studio }: ComponentProps<typeof CreationStudio> & { hasDraft: boolean }) {
  const [tab, setTab] = useState<Tab>(hasDraft ? "ia" : "plantillas");
  return (
    <div className="space-y-4">
      <div className="fl-seg inline-flex" role="radiogroup" aria-label="Cómo quieres crear tu página">
        {(
          [
            ["plantillas", "📄 Plantillas listas"],
            ["ia", "✦ Crear con IA"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={tab === key} onClick={() => setTab(key)} className="fl-seg-item px-4 py-2 text-sm">
            {label}
          </button>
        ))}
      </div>
      {tab === "plantillas" ? (
        <TemplateGallery businessId={studio.businessId} needsWhatsapp={!!studio.needsWhatsapp} onChooseAI={() => setTab("ia")} />
      ) : (
        <CreationStudio {...studio} />
      )}
    </div>
  );
}
