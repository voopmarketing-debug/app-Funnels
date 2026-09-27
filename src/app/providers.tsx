"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

// The inline <head> script in layout.tsx applies the saved theme before first
// paint, but if React ever has to re-render the whole page client-side (e.g.
// after a hydration mismatch) it resets <html>'s attributes and the light
// theme is lost. Re-applying it on mount covers that case.
function ThemeSync() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem("fl-theme") === "light") {
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      // Storage unavailable — default dark theme stays.
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeSync />
      {children}
    </SessionProvider>
  );
}
