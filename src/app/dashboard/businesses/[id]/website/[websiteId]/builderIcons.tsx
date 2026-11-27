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
