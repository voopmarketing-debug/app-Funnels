"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem("fl-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Client-selectable dark/light toggle — the brand defaults to dark, but the
// business owner can switch from the dashboard (or any auth screen) if they
// prefer a light workspace. Persisted in localStorage; see the inline
// beforeInteractive script in layout.tsx for the flash-free initial paint.
export function ThemeToggle({
  className = "fl-nav-icon",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("fl-theme", next);
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  }

  const current = theme ?? "dark";
  const label = current === "light" ? "Modo oscuro" : "Modo claro";

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-label={current === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={current === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      {current === "light" ? <MoonIcon /> : <SunIcon />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
