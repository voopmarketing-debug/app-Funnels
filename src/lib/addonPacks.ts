// Pure catalog (no server imports) so client components can render the
// store. Prices in COP — Mercado Pago Colombia charges in pesos.
//
// Priced for ≥50% gross margin AFTER Mercado Pago's ~4% fee, assuming a
// fairly heavy contact (~15 AI replies in the month ≈ US$0.12 of Claude
// usage incl. prompt caching, images and voice notes, at ~4.000 COP/USD).
// A typical contact (~8–10 replies, ≈ US$0.08) leaves ~65–70%. Lines add
// no AI cost on their own (contacts are pooled per account, see
// getAccountActiveContactsThisMonth), so they're almost pure margin.
export type AddonKind = "CONTACTS" | "LINE";

export type AddonPack = {
  key: string;
  kind: AddonKind;
  quantity: number;
  priceCop: number;
  title: string;
  description: string;
  highlight?: boolean;
};

export const ADDON_PACKS: AddonPack[] = [
  {
    key: "CONTACTS_200",
    kind: "CONTACTS",
    quantity: 200,
    priceCop: 219_000,
    title: "+200 contactos",
    description: "Para un mes con un poco más de movimiento.",
  },
  {
    key: "CONTACTS_400",
    kind: "CONTACTS",
    quantity: 400,
    priceCop: 429_000,
    title: "+400 contactos",
    description: "Duplica la capacidad del plan Starter.",
    highlight: true,
  },
  {
    key: "CONTACTS_1000",
    kind: "CONTACTS",
    quantity: 1000,
    priceCop: 1_049_000,
    title: "+1.000 contactos",
    description: "Para campañas grandes o temporada alta.",
  },
  {
    key: "LINE_1",
    kind: "LINE",
    quantity: 1,
    priceCop: 119_000,
    title: "+1 línea de WhatsApp",
    description: "Otro número con su propio agente (otra sede, marca o vendedor).",
  },
];

// Every pack lasts this long from the moment it's paid.
export const ADDON_DURATION_DAYS = 30;

export function findPack(key: string): AddonPack | undefined {
  return ADDON_PACKS.find((p) => p.key === key);
}

export function formatCop(value: number): string {
  return `$${value.toLocaleString("es-CO")} COP`;
}
