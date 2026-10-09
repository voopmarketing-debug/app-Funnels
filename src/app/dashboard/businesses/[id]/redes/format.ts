/** Money in the ad account's currency, e.g. "$ 45.200" for COP. */
export function moneyFormatter(currency: string) {
  // Cents only where they matter (a US$0,45 click); "$ 1.348", not "$ 1.347,76".
  const whole = new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 });
  const cents = new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 });
  return (n: number | null | undefined) => (n == null ? "—" : Math.abs(n) >= 100 ? whole.format(n) : cents.format(n));
}

// Dates are built by hand: Node and the browser ship different ICU data and
// disagree on the spaces inside "10:00 a. m.", which breaks hydration.
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const bogota = (iso: string) => new Date(Date.parse(iso) - 5 * 3_600_000); // Colombia has no DST

/** "8 oct, 10:05 a. m." in Colombia time. */
export function shortDateTime(iso: string): string {
  const d = bogota(iso);
  const h = d.getUTCHours();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

/** "8 oct 2026" in Colombia time. */
export function shortDate(iso: string): string {
  const d = bogota(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
