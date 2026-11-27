"use client";

import { useState } from "react";
import { BUTTON_LINK, SECTION_LABELS, type WebsiteContentV2 } from "@/lib/websiteContentV2";

type Row = { id: string; where: string; label: string; url: string; save: (url: string | null) => void };

/**
 * "Botones": every button of the page with its own link. Empty = it goes where the page's main button goes
 * (your WhatsApp or the main link); a link here sends just that button somewhere else (another landing, an agenda…).
 */
export function ButtonLinksPanel({
  content,
  disabled,
  onSection,
  onHeader,
}: {
  content: WebsiteContentV2;
  disabled: boolean;
  onSection: (index: number, key: string, url: string | null) => void;
  onHeader: (url: string | null) => void;
}) {
  const rows: Row[] = [];
  if (!content.plain) rows.push({ id: "header", where: "Menú de arriba", label: content.chrome?.headerLabel || "Escríbenos", url: content.chrome?.headerLink ?? "", save: onHeader });
  content.sections.forEach((s, i) => {
    for (const key of ["ctaLabel", "secondaryCtaLabel"] as const) {
      const label = (s as unknown as Record<string, unknown>)[key];
      if (typeof label !== "string" || !label.trim()) continue;
      rows.push({ id: `${i}.${key}`, where: SECTION_LABELS[s.type], label: label.replace(/[⁣⁤]/g, "").replace(/#[0-9a-fA-F]{6}/g, ""), url: s.links?.[key] ?? "", save: (url) => onSection(i, key, url) });
    }
  });
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Botones</p>
      <p className="text-[12px] text-ink-muted">Pon un link distinto a cada botón. Vacío = el botón principal.</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <ButtonLinkRow key={`${r.id}:${r.url}`} row={r} disabled={disabled} />
        ))}
      </ul>
    </div>
  );
}

function ButtonLinkRow({ row, disabled }: { row: Row; disabled: boolean }) {
  const [value, setValue] = useState(row.url);
  const trimmed = value.trim();
  const invalid = trimmed !== "" && !BUTTON_LINK.test(trimmed);
  const commit = () => {
    if (invalid || trimmed === row.url) return;
    row.save(trimmed || null);
  };
  return (
    <li className="space-y-1 rounded-lg border border-border bg-background p-2.5">
      <p className="truncate text-[12px] text-ink-muted">
        <span className="font-semibold text-ink">{row.label}</span> · {row.where}
      </p>
      <input
        aria-label={`Link del botón ${row.label}`}
        inputMode="url"
        maxLength={300}
        disabled={disabled}
        value={value}
        placeholder="https://… (vacío = botón principal)"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent ${invalid ? "border-error" : "border-border"}`}
      />
      {invalid && <p className="text-[12px] text-error">Empieza con https://, tel:, mailto: o #.</p>}
    </li>
  );
}
