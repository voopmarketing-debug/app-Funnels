"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/authz";
import { verifyChatUpload } from "@/lib/attachments";
import { MAX_CATALOG_PRODUCTS, changeStock, notifyStockLevel } from "@/lib/inventory";

export type ProductInput = {
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  category: string | null;
  badge: string | null;
  imageUrl: string | null;
  active: boolean;
  trackStock: boolean;
  stock: number | null;
  lowStockAt: number | null;
};

// Kept small on purpose: the whole catalog goes into the AI agent's context.
const MAX_PRODUCTS = MAX_CATALOG_PRODUCTS;

const units = (v: number | null, fallback: number) => (v === null || !Number.isFinite(v) || v < 0 ? fallback : Math.min(Math.round(v), 1_000_000));

function clean(input: ProductInput) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Ponle un nombre al producto");
  const money = (v: number | null) => (v === null || !Number.isFinite(v) || v < 0 ? null : Math.round(Math.min(v, 2_000_000_000)));
  return {
    name,
    description: input.description.trim().slice(0, 1200),
    price: money(input.price),
    compareAtPrice: money(input.compareAtPrice),
    category: input.category?.trim().slice(0, 60) || null,
    badge: input.badge?.trim().slice(0, 24) || null,
    active: input.active,
    trackStock: input.trackStock,
    stock: units(input.stock, 0),
    lowStockAt: units(input.lowStockAt, 5),
  };
}

async function requireAccess(businessId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);
}

// A new photo arrives as a URL the browser just uploaded to our Blob store
// under products/{businessId}/ — re-checked here (our store, that folder,
// an actual image). An unchanged photo is the URL already saved.
async function resolveImage(businessId: string, url: string | null, current: string | null): Promise<string | null> {
  if (!url) return null;
  if (url === current) return current;
  const uploaded = await verifyChatUpload({ url, businessId, folder: "products" });
  if (uploaded.mediaType !== "image") throw new Error("La foto del producto debe ser una imagen");
  return uploaded.url;
}

// Returns the error instead of throwing: Next.js hides a thrown error's
// message in production, and these ("ponle un nombre…") are for the user.
export async function saveProduct(
  businessId: string,
  productId: string | null,
  input: ProductInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveProductOrThrow(businessId, productId, input);
    return { ok: true };
  } catch (err) {
    console.error("saveProduct failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar el producto" };
  }
}

async function saveProductOrThrow(businessId: string, productId: string | null, input: ProductInput): Promise<void> {
  await requireAccess(businessId);
  const data = clean(input);

  if (productId) {
    const existing = await prisma.product.findFirstOrThrow({ where: { id: productId, businessId } });
    const imageUrl = await resolveImage(businessId, input.imageUrl, existing.imageUrl);
    await prisma.product.update({ where: { id: productId }, data: { ...data, imageUrl } });
    if (data.trackStock) {
      await notifyStockLevel(businessId, { id: productId, name: data.name, lowStockAt: data.lowStockAt }, existing.trackStock ? existing.stock : Infinity, data.stock);
    }
  } else {
    const count = await prisma.product.count({ where: { businessId } });
    if (count >= MAX_PRODUCTS) {
      throw new Error(`Tu catálogo llegó al máximo de ${MAX_PRODUCTS} productos. Elimina u oculta los que ya no vendes para agregar nuevos.`);
    }
    const imageUrl = await resolveImage(businessId, input.imageUrl, null);
    await prisma.product.create({ data: { ...data, imageUrl, businessId, position: count } });
  }
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
  revalidatePath(`/dashboard/businesses/${businessId}/inventario`);
}

export async function deleteProduct(businessId: string, productId: string): Promise<void> {
  await requireAccess(businessId);
  await prisma.product.deleteMany({ where: { id: productId, businessId } });
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
}

/** Moves a product one place up or down in the catalog order. */
export async function moveProduct(businessId: string, productId: string, direction: -1 | 1): Promise<void> {
  await requireAccess(businessId);
  const products = await prisma.product.findMany({
    where: { businessId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = products.findIndex((p) => p.id === productId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= products.length) return;
  const ids = products.map((p) => p.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  await prisma.$transaction(ids.map((id, position) => prisma.product.update({ where: { id }, data: { position } })));
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
}

/**
 * From Inventario: "add" receives merchandise (+units), "set" corrects the
 * count after a physical check or a sale made outside the platform.
 */
export async function adjustStock(
  businessId: string,
  productId: string,
  mode: "add" | "set",
  value: number,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  try {
    await requireAccess(businessId);
  } catch {
    return { ok: false, error: "No tienes acceso a este negocio" };
  }
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: "Escribe un número de unidades válido" };
  const product = await prisma.product.findFirst({ where: { id: productId, businessId }, select: { trackStock: true, stock: true } });
  if (!product) return { ok: false, error: "Ese producto ya no existe" };
  if (!product.trackStock) await prisma.product.update({ where: { id: productId }, data: { trackStock: true, stock: 0 } });
  const current = product.trackStock ? product.stock : 0;
  const stock = await changeStock(businessId, productId, mode === "add" ? n : n - current);
  revalidatePath(`/dashboard/businesses/${businessId}/inventario`);
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
  return { ok: true, stock: stock ?? n };
}

/** Turns inventory tracking on or off for one product. */
export async function setTrackStock(businessId: string, productId: string, trackStock: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAccess(businessId);
  } catch {
    return { ok: false, error: "No tienes acceso a este negocio" };
  }
  await prisma.product.updateMany({ where: { id: productId, businessId }, data: { trackStock } });
  revalidatePath(`/dashboard/businesses/${businessId}/inventario`);
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
  return { ok: true };
}

/** The "avísame cuando queden" line for one product. */
export async function setLowStockAt(businessId: string, productId: string, value: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAccess(businessId);
  } catch {
    return { ok: false, error: "No tienes acceso a este negocio" };
  }
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return { ok: false, error: "Escribe un número válido" };
  await prisma.product.updateMany({ where: { id: productId, businessId }, data: { lowStockAt: n } });
  revalidatePath(`/dashboard/businesses/${businessId}/inventario`);
  return { ok: true };
}
