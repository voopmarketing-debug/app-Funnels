import { STYLE_SWATCH } from "@/lib/websiteStylePreview";
import type { StyleKey } from "@/lib/websiteContentV2";

/** A tiny mock web page drawn in a style's colors and shapes. */
export function StyleThumb({ style, className = "" }: { style: StyleKey; className?: string }) {
  const s = STYLE_SWATCH[style];
  return (
    <div className={`overflow-hidden ${className}`} style={{ background: s.bg, color: s.text }} aria-hidden="true">
      <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: `1px solid ${s.text}1a` }}>
        <span className="h-1.5 w-8 rounded-full" style={{ background: s.text, opacity: 0.8 }} />
        <span className="h-2.5 w-7" style={{ background: s.accent, borderRadius: s.radius }} />
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-2 p-2">
        <div className="space-y-1">
          <div
            className="leading-none"
            style={{ fontFamily: s.serif ? "Georgia, serif" : "system-ui, sans-serif", fontWeight: s.upper ? 900 : 700, fontSize: 13, textTransform: s.upper ? "uppercase" : "none" }}
          >
            {s.upper ? "NUEVO" : "Titular"}
          </div>
          <span className="block h-1 w-full rounded-full" style={{ background: s.text, opacity: 0.25 }} />
          <span className="block h-1 w-3/4 rounded-full" style={{ background: s.text, opacity: 0.25 }} />
          <span className="mt-1 block h-3 w-10" style={{ background: s.accent, borderRadius: s.radius }} />
        </div>
        <div className="aspect-square" style={{ background: s.surface, borderRadius: s.radius }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-5" style={{ background: s.surface, borderRadius: Math.min(s.radius, 8) }} />
        ))}
      </div>
    </div>
  );
}
