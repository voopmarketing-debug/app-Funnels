import type { ReactNode } from "react";

// One line icon per niche of the template library (same look as the side menu: drawn with the current text color).

const svg = (children: ReactNode) =>
  function NicheSvg({ className = "h-[18px] w-[18px]" }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
        {children}
      </svg>
    );
  };

const ICONS: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  all: svg(<><rect x="4" y="4" width="7" height="7" rx="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.8" /></>),
  embudos: svg(<path d="M4 5h16l-6 7.500V19l-4 1.500v-8L4 5Z" />),
  contadores: svg(<><rect x="5" y="3" width="14" height="18" rx="2.500" /><rect x="8" y="6" width="8" height="3.500" rx=".8" /><path d="M8.500 13h.01M12 13h.01M15.500 13h.01M8.500 17h.01M12 17h.01M15.500 17h.01" strokeWidth={2.200} /></>),
  esteticas: svg(<><path d="m12 3 1.800 4.700L18.500 9.500l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800L12 3Z" /><path d="m18.500 15.500.7 1.800 1.800.7-1.800.7-.7 1.800-.7-1.800-1.800-.7 1.800-.7.7-1.800Z" /></>),
  odontologos: svg(<path d="M8 3.500c-2.200 0-4 1.600-4 4 0 2 .8 3.200 1.300 5 .5 2 .5 4.500 1.200 7 .3 1 1.800 1.200 2.300 0 .6-1.700.7-3.700 1.500-4.500.4-.4.9-.4 1.300 0 .8.800.9 2.800 1.500 4.500.5 1.200 2 1 2.300 0 .7-2.500.7-5 1.200-7 .5-1.800 1.300-3 1.300-5 0-2.400-1.800-4-4-4-1.300 0-2.200.600-3 .6S9.300 3.500 8 3.500Z" />),
  abogados: svg(<><path d="M12 4v16M8 20h8M5 7h14" /><path d="m5 7-3 7a3.500 3.500 0 0 0 6 0L5 7Zm14 0-3 7a3.500 3.500 0 0 0 6 0l-3-7Z" /></>),
  psicologos: svg(<><path d="M9.500 4A4.500 4.500 0 0 0 5 8.500c0 .8.200 1.500.600 2.100A4 4 0 0 0 7 18.200V19a1.500 1.500 0 0 0 1.500 1.500h1" /><path d="M14.500 4A4.500 4.500 0 0 1 19 8.500c0 .8-.2 1.500-.6 2.100A4 4 0 0 1 17 18.200V19a1.500 1.500 0 0 1-1.500 1.500h-1" /><path d="M12 4v16.500M9 9.500h3M12 13.500h3" /></>),
  veterinarias: svg(<><circle cx="6.500" cy="10" r="1.900" /><circle cx="10.500" cy="6" r="1.900" /><circle cx="15.500" cy="6" r="1.900" /><circle cx="19" cy="10" r="1.900" /><path d="M12.800 11.500c-2.600 0-5 3.300-5 5.200 0 1.700 1.500 2.300 2.800 2 .8-.2 1.400-.5 2.200-.5s1.400.3 2.200.5c1.300.3 2.800-.3 2.800-2 0-1.900-2.400-5.200-5-5.200Z" /></>),
  gimnasios: svg(<><path d="M6.500 7v10M3.500 9v6M17.500 7v10M20.500 9v6M6.500 12h11" /></>),
  inmobiliarias: svg(<><path d="M3.500 11 12 4l8.500 7" /><path d="M5.500 9.500V20h13V9.500" /><path d="M10 20v-5.500h4V20" /></>),
};

/** The line icon of a niche (or "all"); renders nothing for a niche without one. */
export function NicheIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id];
  return Icon ? <Icon className={className} /> : null;
}
