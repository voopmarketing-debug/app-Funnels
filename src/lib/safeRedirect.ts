/**
 * A path from the address bar ("?callbackUrl=...") that is safe to send the
 * visitor to after login: only a path on this same site. Browsers read
 * "/\evil.com" and "/<tab>/evil.com" as "//evil.com", so a leading "//" check
 * is not enough: the path is parsed against a fake origin and must stay on it.
 */
export function safeCallbackPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Backslashes, tabs, line breaks and other control characters are what the
  // browser normalises into a second slash.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const base = "https://app.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
