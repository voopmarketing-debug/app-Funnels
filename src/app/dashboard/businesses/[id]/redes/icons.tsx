// Glyphs for the Redes sociales metric tiles (white on the tile's colour).

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-none" aria-hidden="true">
      {children}
    </svg>
  );
}

export const FacebookGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-none" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
  </svg>
);

export const InstagramGlyph = () => (
  <Base>
    <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="2" />
    <circle cx="16.8" cy="7.2" r="1.1" fill="currentColor" />
  </Base>
);

export const UsersIcon = () => (
  <Base>
    <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="2" />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.6c1.6.5 2.7 1.9 3 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Base>
);

export const EyeIcon = () => (
  <Base>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </Base>
);

export const HeartIcon = () => (
  <Base>
    <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </Base>
);

export const GridIcon = () => (
  <Base>
    <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
  </Base>
);

export const PercentIcon = () => (
  <Base>
    <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="7.5" cy="7.5" r="2.3" stroke="currentColor" strokeWidth="2" />
    <circle cx="16.5" cy="16.5" r="2.3" stroke="currentColor" strokeWidth="2" />
  </Base>
);

export const RepeatIcon = () => (
  <Base>
    <path d="M5 11V9.5A3.5 3.5 0 0 1 8.5 6H19m0 0-3-3m3 3-3 3M19 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Base>
);

export const TargetIcon = () => (
  <Base>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Base>
);

export const TrendIcon = () => (
  <Base>
    <path d="M3.5 17 9 11.5l3.5 3.5L20.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 7h5.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Base>
);
