function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-none">
      {children}
    </svg>
  );
}

export function ChatIcon() {
  return (
    <IconBase>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function MessageIcon() {
  return (
    <IconBase>
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function BoltIcon() {
  return (
    <IconBase>
      <path
        d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function AlertIcon() {
  return (
    <IconBase>
      <path
        d="M12 4 3 20h18L12 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M12 10.5v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </IconBase>
  );
}

export function LayersIcon() {
  return (
    <IconBase>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m4 12 8 4.5 8-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 16.5 8 4.5 8-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function HourglassIcon() {
  return (
    <IconBase>
      <path
        d="M6 3.5h12M6 20.5h12M7 3.5v3.4c0 1.3.6 2.5 1.6 3.3l2.4 1.8 2.4-1.8c1-.8 1.6-2 1.6-3.3V3.5M7 20.5v-3.4c0-1.3.6-2.5 1.6-3.3l2.4-1.8 2.4 1.8c1 .8 1.6 2 1.6 3.3v3.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function GlobeIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CursorClickIcon() {
  return (
    <IconBase>
      <path d="m6 4 3.5 13.5 2-4.8 4.8-2L6 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M16 16.5 19 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

export function WhatsAppSmallIcon() {
  return (
    <IconBase>
      <path
        d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 8.3c.2-.4.4-.4.6-.4h.5c.15 0 .35 0 .5.4.2.5.6 1.5.65 1.6.05.15.1.3 0 .45-.1.2-.15.3-.3.45-.15.15-.3.3-.15.55.4.7 1.6 2 2.6 2.3.2.05.35 0 .5-.15.15-.15.5-.6.65-.8.15-.2.3-.15.5-.1.2.1 1.3.6 1.5.7.2.1.35.15.4.25.05.15.05.7-.2 1.3-.25.6-1.3 1.1-1.8 1.15-.45.05-.9.1-2.9-.6-2.5-.9-4.1-3.4-4.2-3.6-.1-.2-.9-1.2-.9-2.3 0-1.1.55-1.6.75-1.85Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function CalendarLinkIcon() {
  return (
    <IconBase>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 9.5h16M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 14.5l2.5 2.5L15.5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CostIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path
        d="M14.5 9.5c0-1-1-1.8-2.5-1.8s-2.5.8-2.5 1.8.9 1.5 2.5 1.8c1.6.3 2.5.8 2.5 1.9s-1 1.8-2.5 1.8-2.5-.7-2.5-1.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 6.3v1.4M12 16.3v1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

export function CalendarCheckIcon() {
  return (
    <IconBase>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 9.5h16M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 14l2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function FunnelIcon() {
  return (
    <IconBase>
      <path d="M4 5h16l-6 7.5v5l-4 2v-7L4 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </IconBase>
  );
}

export function RegisterFormIcon() {
  return (
    <IconBase>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
