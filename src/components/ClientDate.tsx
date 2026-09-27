"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Formats a date in the browser only. Server (Node) and browser ICU builds
 * don't always produce byte-identical strings for the same date — e.g. the
 * space in "12:55 p. m." is a narrow no-break space in one and a regular
 * space in the other — and any difference makes React discard the server
 * HTML and re-render the whole page (which also reset the saved light theme
 * on <html>). Rendering empty on the server and during hydration, then the
 * formatted text right after, can never mismatch.
 */
export function ClientDate({
  date,
  options,
  timeZone = "America/Bogota",
}: {
  date: Date | string;
  options: Intl.DateTimeFormatOptions;
  timeZone?: string;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;
  return <>{new Intl.DateTimeFormat("es-CO", { ...options, timeZone }).format(new Date(date))}</>;
}
