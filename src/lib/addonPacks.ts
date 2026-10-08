// Pure catalog (no server imports) so client components can render the
// store. Prices in COP — Mercado Pago Colombia charges in pesos.
//
// Priced for ≥40% gross margin AFTER Mercado Pago's ~4% fee with a
// conservative AI cost of ~440 COP per contact (≈12 replies incl. some
// photos/voice notes, ~US$0.11 at ~4.000 COP/USD; a typical contact is
// ~360 COP and leaves ~50%+). Always cheaper per contact than the Starter
// plan itself (975 COP), and cheaper the bigger the pack. Lines add no AI
// cost on their own (contacts are pooled per account), so they're almost
// pure margin.
export type AddonKind = "CONTACTS" | "LINE";

export type AddonPack = {
  key: string;
  kind: AddonKind;
  quantity: number;
  priceCop: number;
  title: string;
  description: string;
  highlight?: boolean;
  // Older packs kept only so past purchases still show their name; not sold.
  retired?: boolean;
};

export const ADDON_PACKS: AddonPack[] = [
  {
    key: "CONTACTS_100",
    kind: "CONTACTS",
    quantity: 100,
    priceCop: 89_000,
    title: "+100 clientes con IA",
    description: "Para cerrar el mes sin que tu agente se detenga.",
  },
  {
    key: "CONTACTS_250",
    kind: "CONTACTS",
    quantity: 250,
    priceCop: 209_000,
    title: "+250 clientes con IA",
    description: "Para un mes con más movimiento o una promoción.",
  },
  {
    key: "CONTACTS_500",
    kind: "CONTACTS",
    quantity: 500,
    priceCop: 399_000,
    title: "+500 clientes con IA",
    description: "Más del doble de capacidad del plan Starter.",
    highlight: true,
  },
  {
    key: "CONTACTS_1000",
    kind: "CONTACTS",
    quantity: 1000,
    priceCop: 789_000,
    title: "+1.000 clientes con IA",
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
  { key: "CONTACTS_200", kind: "CONTACTS", quantity: 200, priceCop: 219_000, title: "+200 clientes con IA", description: "", retired: true },
  { key: "CONTACTS_400", kind: "CONTACTS", quantity: 400, priceCop: 429_000, title: "+400 clientes con IA", description: "", retired: true },
];

// Every pack lasts this long from the moment it's paid.
export const ADDON_DURATION_DAYS = 30;

export function findPack(key: string): AddonPack | undefined {
  return ADDON_PACKS.find((p) => p.key === key);
}

export function formatCop(value: number): string {
  return `$${value.toLocaleString("es-CO")} COP`;
}
