// The currencies a business can charge in. Whole units only (no cents), as
// everywhere else prices are stored.
export const CURRENCIES = [
  { code: "COP", symbol: "$", short: "COP", label: "Pesos colombianos" },
  { code: "USD", symbol: "US$", short: "USD", label: "Dólares" },
  { code: "EUR", symbol: "€", short: "EUR", label: "Euros" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "COP";

export function isCurrency(value: unknown): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value);
}

/** The code if it is one we support, else the default (an old or unknown value never breaks a page). */
export function asCurrency(value: unknown): CurrencyCode {
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
}

export function currencySymbol(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$";
}

/** "$89.000", "US$97" or "€97": the symbol first, thousands in the habit of each currency. */
export function formatMoney(value: number, currency: string): string {
  const code = asCurrency(currency);
  if (code === "USD") return `US$${value.toLocaleString("en-US")}`;
  if (code === "EUR") return `€${value.toLocaleString("de-DE")}`;
  return `$${value.toLocaleString("es-CO")}`;
}
