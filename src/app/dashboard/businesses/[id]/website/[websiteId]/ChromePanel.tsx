"use client";

import { useState } from "react";
import type { Chrome, WebsiteContentV2 } from "@/lib/websiteContentV2";
import { ColorRow } from "./StylePanel";
import { ImageIcon, TrashIcon } from "./builderIcons";

/**
 * "Encabezado y pie": the page's own top bar (logo or name, menu colors, button color) and footer
 * (texts and colors). The name and the footer texts can also be written right on the page.
 */
export function ChromePanel({
  chrome,
  theme,
  busy,
  onChange,
  onPickLogo,
}: {
  chrome: Chrome | undefined;
  theme: WebsiteContentV2["theme"];
  busy: boolean;
  onChange: (patch: Partial<Record<keyof Chrome, string | null>>) => void;
  onPickLogo: () => void;
}) {
  const c = chrome ?? {};
  const swatches = [theme.primaryColor, theme.backgroundColor, theme.surfaceColor, theme.textColor, "#ffffff", "#0b0b0c"].filter((x) => /^#[0-9a-fA-F]{6}$/.test(x));
  const [brand, setBrand] = useState(c.brandName ?? "");
  const [ftext, setFtext] = useState(c.footerText ?? "");
  const [flink, setFlink] = useState(c.footerLink ?? "");
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <p className="text-sm font-semibold text-ink">Encabezado y pie</p>

      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-ink">Logo</p>
        <div className="flex items-center gap-2">
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo} alt="" className="h-12 w-24 flex-none rounded-md border border-border bg-background object-contain p-1" />
          ) : (
            <span className="flex h-12 w-24 flex-none items-center justify-center rounded-md border border-dashed border-border text-ink-faint">
              <ImageIcon className="h-5 w-5" />
            </span>
          )}
          <button type="button" disabled={busy} onClick={onPickLogo} className="h-10 flex-1 rounded-lg border border-border-strong text-sm font-bold text-ink transition hover:border-accent disabled:opacity-40">
            {c.logo ? "Cambiar logo" : "Poner mi logo"}
          </button>
          {c.logo && (
            <button type="button" disabled={busy} aria-label="Quitar el logo" title="Quitar el logo" onClick={() => onChange({ logo: null })} className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-error/50 bg-error/10 text-error disabled:opacity-40">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-semibold text-ink">Nombre en el menú</span>
        <input id="chrome-brand" maxLength={60} value={brand} placeholder="El nombre de tu negocio" onChange={(e) => setBrand(e.target.value)} onBlur={() => brand.trim() !== (c.brandName ?? "") && onChange({ brandName: brand.trim() || null })} className={field} />
      </label>

      <ColorRow label="Fondo del menú" value={c.headerBg} autoLabel="Automático" swatches={swatches} onChange={(hex) => onChange({ headerBg: hex })} />
      <ColorRow label="Texto del menú" value={c.headerColor} autoLabel="Automático" swatches={swatches} onChange={(hex) => onChange({ headerColor: hex })} />
      <ColorRow label="Botón del menú" value={c.headerBtn} autoLabel="Automático" swatches={swatches} onChange={(hex) => onChange({ headerBtn: hex })} />

      <label className="block space-y-1.5">
        <span className="text-[13px] font-semibold text-ink">Texto del pie</span>
        <input id="chrome-footer-text" maxLength={120} value={ftext} placeholder="© Tu negocio" onChange={(e) => setFtext(e.target.value)} onBlur={() => ftext.trim() !== (c.footerText ?? "") && onChange({ footerText: ftext.trim() || null })} className={field} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[13px] font-semibold text-ink">Enlace del pie</span>
        <input id="chrome-footer-link" maxLength={60} value={flink} placeholder="Escríbenos por WhatsApp" onChange={(e) => setFlink(e.target.value)} onBlur={() => flink.trim() !== (c.footerLink ?? "") && onChange({ footerLink: flink.trim() || null })} className={field} />
      </label>
      <ColorRow label="Fondo del pie" value={c.footerBg} autoLabel="Automático" swatches={swatches} onChange={(hex) => onChange({ footerBg: hex })} />
      <ColorRow label="Texto del pie" value={c.footerColor} autoLabel="Automático" swatches={swatches} onChange={(hex) => onChange({ footerColor: hex })} />
    </div>
  );
}
