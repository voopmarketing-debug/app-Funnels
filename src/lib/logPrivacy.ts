/** "juan.perez@gmail.com" → "ju***@gmail.com": enough to tell accounts apart in logs without storing the address. */
export function maskEmail(email: string | null | undefined): string {
  const value = String(email ?? "").trim().toLowerCase();
  const at = value.indexOf("@");
  if (at < 1) return value ? "***" : "";
  return `${value.slice(0, Math.min(2, at))}***${value.slice(at)}`;
}
