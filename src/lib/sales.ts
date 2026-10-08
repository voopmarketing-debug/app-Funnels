// Shared by the CRM (client) and the server: which pipeline stages mean
// "this lead bought". Moving a lead into one of these offers to register
// the sale right there, so the Ventas KPIs fill themselves as the team
// works the funnel instead of needing a separate data-entry step.
// Not "venta"/"cliente" alone: "Cliente potencial" or "En venta" aren't wins.
const WON_STAGE = /ganad|vendid|cerrad|compr[oó](?![a-z])|pagad|venta (cerrada|hecha|ganada)/i;

export function isWonStageName(name: string): boolean {
  return WON_STAGE.test(name) && !/perdid/i.test(name);
}

export type SaleRow = {
  id: string;
  amount: number;
  currency: string;
  productName: string | null;
  note: string | null;
  aiAssisted: boolean;
  closedAt: string; // ISO
};

export type SaleProductOption = { id: string; name: string; price: number | null; currency: string };
