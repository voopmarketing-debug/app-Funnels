"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/authz";
import type { SaleProductOption, SaleRow } from "@/lib/sales";

// Sales registered by the business's team from the CRM (a contact's ficha,
// or when a lead is moved to a "Ganado"-type stage). Results are returned
// as { ok, error } because production redacts thrown messages.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function sessionMember(businessId: string): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    await requireBusinessMembership(session.user.id, businessId);
  } catch {
    return null;
  }
  return session.user.id;
}

function toRow(s: {
  id: string;
  amount: number;
  currency: string;
  productName: string | null;
  note: string | null;
  aiAssisted: boolean;
  closedAt: Date;
}): SaleRow {
  return { ...s, closedAt: s.closedAt.toISOString() };
}

/** The contact's sales plus the catalog, for the ficha and the sale dialog. */
export async function getConversationSales(
  businessId: string,
  conversationId: string,
): Promise<Result<{ sales: SaleRow[]; products: SaleProductOption[] }>> {
  if (!(await sessionMember(businessId))) return { ok: false, error: "No tienes acceso a este negocio" };
  const [sales, products] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, conversationId },
      orderBy: { closedAt: "desc" },
      select: { id: true, amount: true, currency: true, productName: true, note: true, aiAssisted: true, closedAt: true },
    }),
    prisma.product.findMany({
      where: { businessId, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, price: true, currency: true },
      take: 200,
    }),
  ]);
  return { ok: true, sales: sales.map(toRow), products };
}

export async function registerSale(
  businessId: string,
  conversationId: string,
  input: { amount: number; productId?: string | null; productName?: string | null; note?: string | null },
): Promise<Result<{ sale: SaleRow }>> {
  const userId = await sessionMember(businessId);
  if (!userId) return { ok: false, error: "No tienes acceso a este negocio" };

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Escribe el valor de la venta" };
  if (amount > 2_000_000_000) return { ok: false, error: "El valor es demasiado alto" };

  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { id: true } });
  if (!conversation) return { ok: false, error: "No encontramos este contacto" };

  const product = input.productId
    ? await prisma.product.findFirst({ where: { id: input.productId, businessId }, select: { id: true, name: true, currency: true } })
    : null;
  const productName = (product?.name ?? input.productName ?? "").trim().slice(0, 120) || null;

  // "Generada con IA": the agent answered this contact at some point
  // (model is only set on real AI replies, not on human or system messages).
  const aiReply = await prisma.message.findFirst({
    where: { conversationId, role: "AGENT", sentByHuman: false, model: { not: null } },
    select: { id: true },
  });
  // Keep one currency per business: the catalog's, else the last sale's.
  const lastSale = product ? null : await prisma.sale.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" }, select: { currency: true } });

  const sale = await prisma.sale.create({
    data: {
      businessId,
      conversationId,
      productId: product?.id ?? null,
      productName,
      amount,
      currency: product?.currency ?? lastSale?.currency ?? "COP",
      note: input.note?.trim().slice(0, 300) || null,
      aiAssisted: !!aiReply,
      createdByUserId: userId,
    },
    select: { id: true, amount: true, currency: true, productName: true, note: true, aiAssisted: true, closedAt: true },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/analytics`);
  return { ok: true, sale: toRow(sale) };
}

export async function deleteSale(businessId: string, saleId: string): Promise<Result> {
  if (!(await sessionMember(businessId))) return { ok: false, error: "No tienes acceso a este negocio" };
  const { count } = await prisma.sale.deleteMany({ where: { id: saleId, businessId } });
  if (count === 0) return { ok: false, error: "Esa venta ya no existe" };
  revalidatePath(`/dashboard/businesses/${businessId}/analytics`);
  return { ok: true };
}
