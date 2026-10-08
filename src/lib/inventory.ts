import { prisma } from "@/lib/prisma";
import { sendPushToBusiness } from "@/lib/push";

// Inventory: optional per product (trackStock). Units go down with each sale
// registered in the CRM and back up if the sale is deleted; crossing the
// product's lowStockAt or reaching zero notifies the business (bell + push).

/** Most products a catalog can have, so the agent's catalog stays affordable. */
export const MAX_CATALOG_PRODUCTS = 60;

/** Days of stock left at the last 30 days' sales pace, or null without sales. */
export function daysOfStockLeft(stock: number, soldLast30: number): number | null {
  if (soldLast30 <= 0) return null;
  return Math.max(0, Math.floor(stock / (soldLast30 / 30)));
}

type StockProduct = { id: string; name: string; lowStockAt: number };

/** Which alert a stock change deserves: only when it crosses a line, so each one fires once. */
export function stockAlertFor(before: number, after: number, lowStockAt: number): "out" | "low" | null {
  if (after <= 0 && before > 0) return "out";
  if (after > 0 && after <= lowStockAt && before > lowStockAt) return "low";
  return null;
}

/** Notifies when a change takes a product to its low-stock line or to zero (once per crossing). */
export async function notifyStockLevel(businessId: string, product: StockProduct, before: number, after: number): Promise<void> {
  const alert = stockAlertFor(before, after, product.lowStockAt);
  if (!alert) return;
  const soldOut = alert === "out";

  const message = soldOut ? `🚫 Se agotó "${product.name}". Ya no aparece disponible en tu web ni lo ofrece tu agente.` : `⚠️ Quedan ${after} de "${product.name}". Es momento de reponer.`;
  await prisma.notification.create({ data: { businessId, type: soldOut ? "OUT_OF_STOCK" : "LOW_STOCK", message } });
  await sendPushToBusiness(businessId, {
    title: soldOut ? `🚫 Se agotó ${product.name}` : `⚠️ Quedan ${after} de ${product.name}`,
    body: soldOut ? "Repón inventario para seguir vendiéndolo." : "Se está acabando: es momento de reponer.",
    url: `/dashboard/businesses/${businessId}/inventario`,
    tag: `stock-${product.id}`,
  }).catch((err) => console.error("[push] stock alert failed", err));
}

/**
 * Moves a tracked product's stock by `delta` (negative for a sale) without
 * going below zero, and sends the alert if it crossed a line. Returns the
 * new stock, or null when the product doesn't track inventory.
 */
export async function changeStock(businessId: string, productId: string, delta: number): Promise<number | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true, lowStockAt: true, trackStock: true, stock: true },
  });
  if (!product?.trackStock || delta === 0) return product?.trackStock ? product.stock : null;
  const updated = await prisma.product.update({ where: { id: product.id }, data: { stock: { increment: delta } }, select: { stock: true } });
  // Atomic increment, so two sales at once both count; the level before is
  // derived from the result, not from the earlier read.
  const before = Math.max(0, updated.stock - delta);
  let after = updated.stock;
  if (after < 0) {
    await prisma.product.update({ where: { id: product.id }, data: { stock: 0 } });
    after = 0;
  }
  await notifyStockLevel(businessId, product, before, after);
  return after;
}
