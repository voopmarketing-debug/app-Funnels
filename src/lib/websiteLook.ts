import { z } from "zod";

// The "Estilo del bloque" of the builder: how ONE section looks (its own
// background color, text color, spacing, width, alignment, title size and on
// which screens it shows), on top of the page's theme. Stored on each section
// as `look`; only what the owner changed is kept.

export const LOOK_PAD = ["none", "sm", "lg", "xl"] as const;
export const LOOK_WIDTH = ["narrow", "wide", "full"] as const;
export const LOOK_ALIGN = ["left", "center", "right"] as const;
export const LOOK_SIZE = ["sm", "lg", "xl"] as const;
export const LOOK_HIDE = ["mobile", "desktop"] as const;

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional()
  .catch(null);
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable().optional().catch(null);

export const LookSchema = z
  .object({
    bg: hex,
    color: hex,
    padY: choice(LOOK_PAD),
    width: choice(LOOK_WIDTH),
    align: choice(LOOK_ALIGN),
    size: choice(LOOK_SIZE),
    hideOn: choice(LOOK_HIDE),
  })
  .optional()
  .catch(undefined);
export type Look = NonNullable<z.infer<typeof LookSchema>>;
export type LookPatch = Partial<Record<keyof Look, Look[keyof Look]>>;

/** A look with only the fields that are set; undefined when nothing is left (the section is back to the page's own style). */
export function tidyLook(look: Look | null | undefined): Look | undefined {
  if (!look) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(look)) if (value !== null && value !== undefined && value !== "") out[key] = value;
  return Object.keys(out).length ? (out as Look) : undefined;
}

export function mergeLook(current: Look | null | undefined, patch: LookPatch): Look | undefined {
  return tidyLook({ ...(current ?? {}), ...patch } as Look);
}

function readable(hexColor: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.55 ? "#0a0a0a" : "#ffffff";
}

export type LookParts = { classes: string[]; vars: Record<string, string> };

/**
 * The CSS classes and variables a look turns into. The same function builds
 * the public page and the builder's live preview, so what the owner sees while
 * dragging a color is what gets published.
 *  - a background color is skipped where a photo already is the background
 *    (the section's own photo wins);
 *  - the text color follows the background when the owner didn't pick one;
 *  - `showAll` (the builder) never hides a section for a screen size, or it
 *    could not be edited any more.
 */
export function lookParts(look: Look | null | undefined, opts: { photoBg?: boolean; showAll?: boolean } = {}): LookParts {
  const classes: string[] = [];
  const vars: Record<string, string> = {};
  if (!look) return { classes, vars };

  const bg = look.bg && !opts.photoBg ? look.bg : null;
  const text = look.color ?? (bg ? readable(bg) : null);
  if (bg) {
    classes.push("lk-bg");
    vars["--lkbg"] = bg;
  }
  if (text) {
    classes.push("lk-c");
    vars["--lkc"] = text;
  }
  if (look.padY) classes.push(`lk-p-${look.padY}`);
  if (look.width) classes.push(`lk-w-${look.width}`);
  if (look.align) classes.push(`lk-a-${look.align}`);
  if (look.size) classes.push(`lk-t-${look.size}`);
  if (look.hideOn && !opts.showAll) classes.push(look.hideOn === "mobile" ? "lk-hide-m" : "lk-hide-d");
  return { classes, vars };
}

/** The stylesheet rules for the classes above. Appended to the page's own CSS. */
export const LOOK_CSS = `
.lk-bg{background:var(--lkbg)!important;--bg:var(--lkbg);--surface:color-mix(in srgb,var(--lkbg) 90%,var(--lkc,#808080))}
.lk-c{color:var(--lkc)!important;--text:var(--lkc);--muted:color-mix(in srgb,var(--lkc) 66%,transparent);--line:color-mix(in srgb,var(--lkc) 16%,transparent)}
.lk-bg.promo .btn{background:var(--lkc);color:var(--lkbg);border-color:var(--lkc)}
.lk-p-none{padding-top:0!important;padding-bottom:0!important}
.lk-p-sm{padding-top:40px!important;padding-bottom:40px!important}
.lk-p-lg{padding-top:128px!important;padding-bottom:128px!important}
.lk-p-xl{padding-top:184px!important;padding-bottom:184px!important}
.lk-w-narrow .wrap{max-width:820px!important}
.lk-w-wide .wrap{max-width:1400px!important}
.lk-w-full .wrap{max-width:none!important}
.lk-a-left{text-align:left}.lk-a-center{text-align:center}.lk-a-right{text-align:right}
.lk-a-center .intro,.lk-a-center .lead,.lk-a-center .host-body{margin-inline:auto}
.lk-a-right .intro,.lk-a-right .lead{margin-left:auto}
.lk-a-center .hero-actions,.lk-a-center .chips,.lk-a-center .cat-tabs{justify-content:center}
.lk-a-right .hero-actions,.lk-a-right .chips{justify-content:flex-end}
.lk-t-sm{--ts:.8}.lk-t-lg{--ts:1.22}.lk-t-xl{--ts:1.5}
@media (max-width:860px){.lk-hide-m{display:none!important}.lk-p-lg{padding-top:84px!important;padding-bottom:84px!important}.lk-p-xl{padding-top:112px!important;padding-bottom:112px!important}.lk-t-xl{--ts:1.25}}
@media (min-width:861px){.lk-hide-d{display:none!important}}
`;
