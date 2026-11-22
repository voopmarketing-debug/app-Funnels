import { createHash } from "node:crypto";
import { formatMoney, type CatalogProduct } from "@/lib/websiteContentV2";
import { ensureContrast } from "@/lib/colorContrast";
import type { IconName } from "./content";

export function esc(text: string | null | undefined): string {
  return (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function safeUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\//.test(url) ? url : null;
}

/** JSON that can sit inside <script type="application/json"> without ending it early. */
export function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function scriptHash(source: string): string {
  return createHash("sha256").update(source).digest("base64");
}

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "{mes}" becomes the current month, wrapped so the page script keeps it right as the months go by. */
export function withMonth(text: string): string {
  return esc(text).replace(/\{mes\}/g, `<span data-month>${MONTHS[new Date().getMonth()]}</span>`);
}

// All icons in a 24x24 box, stroke only. Used by the page markup and handed to the page script.
const S = (inner: string) => inner;
const g20 = (inner: string) => `<g transform="scale(1.2)">${inner}</g>`;
export const ICON_PATHS: Record<IconName, string> = {
  gauge: g20('<path d="M3.5 14a6.5 6.5 0 1 1 13 0"/><path d="m10 14 3.5-4"/>'),
  gear: g20('<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>'),
  box: g20('<path d="M3 7.5 10 4l7 3.5v6L10 17l-7-3.5z"/><path d="M3 7.5 10 11l7-3.5M10 11v6"/>'),
  road: g20('<path d="M7 3 4 17M13 3l3 14M10 4v2M10 9v2M10 14v2"/>'),
  seat: g20('<path d="M6 3h4l1 8h4l1 6H7z"/>'),
  bolt: S('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
  tow: g20('<circle cx="6" cy="14" r="2"/><circle cx="14" cy="14" r="2"/><path d="M2.5 14V9l2-3h7l2 3h4v5"/>'),
  tag: S('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
  calendar: S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  shield: S('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  star: S('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  check: S('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
  card: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  refresh: S('<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>'),
  doc: S('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  pin: S('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  truck: S('<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
  heart: S('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  chat: S('<path d="M4 5h16v11H9l-5 4z"/>'),
  key: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'),
  leaf: S('<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19c3-3 6-5 9-7"/>'),
  drop: S('<path d="M12 3c3.5 4.5 6 7.4 6 10.5a6 6 0 0 1-12 0C6 10.4 8.5 7.5 12 3z"/>'),
  sparkle: S('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
};

export function iconSvg(name: IconName | string, cls = "ico"): string {
  const inner = ICON_PATHS[name as IconName] ?? ICON_PATHS.check;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** The catalog as the page script needs it. */
export type ClientProduct = {
  id: string;
  name: string;
  desc: string;
  price: number | null;
  currency: string;
  category: string | null;
  badge: string | null;
  soldOut: boolean;
  frames: string[];
};

export function clientProducts(products: CatalogProduct[], opts: { requirePhoto?: boolean; max?: number } = {}): ClientProduct[] {
  return products
    .filter((p) => !opts.requirePhoto || !!safeUrl(p.imageUrl))
    .slice(0, opts.max ?? 12)
    .map((p) => ({
      id: p.id,
      name: p.name,
      desc: (p.description ?? "").slice(0, 600),
      price: p.price,
      currency: p.currency,
      category: p.category,
      badge: p.badge,
      soldOut: !!p.soldOut,
      frames: [safeUrl(p.imageUrl), ...(p.galleryUrls ?? []).map(safeUrl)].filter((u): u is string => !!u).slice(0, 12),
    }));
}

export { formatMoney };

/** The accent as text on white (large display text): at least 3:1; the exact brand color stays on buttons and fills. */
export function accentInk(accent: string): string {
  return ensureContrast(accent, "#ffffff", 3);
}

/** Pulls the page's inline scripts (the ones without attributes) out of rendered HTML for the policy hashes. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) hashes.push(scriptHash(m[1]));
  return hashes;
}
