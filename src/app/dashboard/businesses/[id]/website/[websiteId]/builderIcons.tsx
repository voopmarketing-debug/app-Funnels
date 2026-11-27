import type { ReactNode } from "react";
import type { BlockEntry } from "@/lib/websiteBlocks";

// Small line icons for the page builder's toolbars (one look, drawn with the current text color).

type IconProps = { className?: string };

const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const PlusSquareIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const EditIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 7.5 3 3" />
  </svg>
);

export const PaletteIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1.1-1.5-1.1-2.7 0-1 .8-1.7 1.9-1.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.8 16.7 3.5 12 3.5Z" />
    <circle cx="8" cy="11" r="1" />
    <circle cx="11" cy="7.5" r="1" />
    <circle cx="15.5" cy="8.5" r="1" />
  </svg>
);

export const GearIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.6 7l2.1 1.2M17.3 15.8l2.1 1.2M4.6 17l2.1-1.2M17.3 8.2 19.4 7M2.8 12h2.4M18.8 12h2.4" />
  </svg>
);

export const LinkIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

export const ExternalIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const UndoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h8.5a5 5 0 0 1 0 10H11" transform="translate(0 -3)" />
  </svg>
);

export const RedoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m15 7 4.5 4.5L15 16" />
    <path d="M19 11.5h-8.5a5 5 0 0 0 0 10H13" transform="translate(0 -3)" />
  </svg>
);

export const MinusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 12h12" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 6v12M6 12h12" />
  </svg>
);

export const DesktopIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16.5V20" />
  </svg>
);

export const TabletIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="5.5" y="3" width="13" height="18" rx="2.2" />
    <path d="M11 17.5h2" />
  </svg>
);

export const PhoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="7.5" y="3" width="9" height="18" rx="2.2" />
    <path d="M11 17.5h2" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

const wrap = (children: ReactNode) => {
  const Icon = ({ className }: IconProps) => (
    <svg {...base} strokeWidth={1.6} className={className}>
      {children}
    </svg>
  );
  return Icon;
};

/** One drawn icon per block of the library (and per element that goes inside a block), like a widget panel. */
export const BLOCK_ICON: Record<BlockEntry["type"], (p: IconProps) => React.JSX.Element> = {
  features: wrap(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>),
  steps: wrap(<><circle cx="6" cy="6" r="2.4" /><circle cx="12" cy="12" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M7.7 7.7 10.3 10.3M13.7 13.7l2.6 2.6" /></>),
  host: wrap(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.6-6 7.5-6s6.700 2 7.500 6" /></>),
  gallery: wrap(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m3.500 17 5-4.500 4 3.500 3-2.500 5 4" /></>),
  productGrid: wrap(<><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 11V7a3 3 0 0 1 6 0v4" /></>),
  productSpotlight: wrap(<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800l-5.200 2.800 1-5.800L3.500 9.700l5.900-.8L12 3.500Z" />),
  promo: wrap(<><rect x="3" y="7" width="18" height="10" rx="2.500" /><path d="M7 11h6M7 14h3" /><circle cx="17" cy="12.500" r="1.200" /></>),
  showroom: wrap(<path d="M12 3 20 7.500v9L12 21 4 16.500v-9L12 3Zm0 9 8-4.500M12 12 4 7.500M12 12v9" />),
  quoter: wrap(<><rect x="5" y="3" width="14" height="18" rx="2.500" /><rect x="8" y="6" width="8" height="3.500" rx=".8" /><path d="M8.500 13h.01M12 13h.01M15.500 13h.01M8.500 17h.01M12 17h.01M15.500 17h.01" strokeWidth="2.200" /></>),
  fan: wrap(<><rect x="8" y="5" width="9" height="14" rx="2" transform="rotate(-16 12.500 12)" /><rect x="7" y="5" width="9" height="14" rx="2" transform="rotate(14 11.500 12)" /></>),
  traveler: wrap(<><path d="M12 3.500v17" /><path d="m8 7.500 4-4 4 4M8 16.500l4 4 4-4" /></>),
  marquee: wrap(<><rect x="3" y="8" width="18" height="8" rx="2.500" /><path d="M7 12h6m-2.500-2.500L13 12l-2.500 2.500M17 12h.01" /></>),
  video: wrap(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10.500 9.500 4.500 2.500-4.500 2.500v-5Z" /></>),
  html: wrap(<path d="m8.500 7.500-5 4.500 5 4.500M15.500 7.500l5 4.500-5 4.500M13.500 5.500l-3 13" />),
  event: wrap(<><rect x="3.500" y="5" width="17" height="15.500" rx="2.500" /><path d="M3.500 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.500" /></>),
  offer: wrap(<><path d="M3.500 12.500 12 4h7.500a1 1 0 0 1 1 1V12.500L12 21l-8.500-8.500Z" /><circle cx="16" cy="8" r="1.300" /></>),
  guarantee: wrap(<><path d="M12 3 4.500 6v5.500c0 4.700 3 8 7.500 9.500 4.500-1.500 7.500-4.800 7.500-9.500V6L12 3Z" /><path d="m8.800 12 2.400 2.400 4.200-4.600" /></>),
  testimonials: wrap(<><path d="M4 5h16v11H11l-4.500 3.500V16H4V5Z" /><path d="M8.500 9.500h2v2.200H8.500zM13.500 9.500h2v2.200h-2z" /></>),
  comparison: wrap(<><rect x="3" y="4" width="18" height="16" rx="2.500" /><path d="M12 4v16M6.500 9.500l1.500 1.500 2.500-3M15 8.500l3 3M18 8.500l-3 3" /></>),
  trustBar: wrap(<><circle cx="6" cy="12" r="3" /><circle cx="18" cy="12" r="3" /><path d="m4.800 12 .9.900 1.600-1.800M16.700 11.100l.9.900 1.600-1.800M10.500 12h3" /></>),
  stats: wrap(<><path d="M4 20V4M4 20h16" /><rect x="7.500" y="11" width="3" height="6" rx=".8" /><rect x="13" y="7" width="3" height="10" rx=".8" /></>),
  objections: wrap(<><circle cx="12" cy="12" r="8.500" /><path d="M9.700 9.600a2.400 2.400 0 1 1 3.400 2.200c-.7.400-1.100 1-1.100 1.800M12 16.800h.01" /></>),
  agenda: wrap(<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.500" cy="6" r="1" /><circle cx="4.500" cy="12" r="1" /><circle cx="4.500" cy="18" r="1" /></>),
  leadForm: wrap(<><rect x="3.500" y="3.500" width="17" height="17" rx="2.500" /><path d="M7 8h10M7 12h10" /><rect x="7" y="15" width="6" height="2.500" rx="1.200" /></>),
  cta: wrap(<><rect x="3" y="7" width="14" height="8" rx="4" /><path d="m14 14 2.500 6 1.600-2.400 2.400-1.600L14 14Z" /></>),
};

export const EXTRA_ICON = {
  text: wrap(<path d="M4 6.500h16M4 11h16M4 15.500h10" />),
  button: wrap(<><path d="M4.500 8.500V7a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4" /><path d="m9 10 .2 9 2.200-2.200 2.300 3.200 1.600-1.100-2.300-3.200 3.100-.3L9 10Z" /></>),
  image: wrap(<><rect x="3" y="4" width="18" height="16" rx="2.500" /><circle cx="9" cy="10" r="1.600" /><path d="m3.500 17 5-4.500 4 3.500 3-2.500 5 4" /></>),
} as const;

export const ChevronLeftIcon = ({ className }: IconProps) => (
  <svg {...base} width={14} height={14} strokeWidth={2.2} className={className}>
    <path d="M14.500 6 8.500 12l6 6" />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg {...base} width={14} height={14} strokeWidth={2.2} className={className}>
    <path d="m9.500 6 6 6-6 6" />
  </svg>
);
