"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/authz";
import { verifyChatUpload } from "@/lib/attachments";

export type ProductInput = {
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  category: string | null;
  badge: string | null;
  imageUrl: string | null;
  active: boolean;
};

const MAX_PRODUCTS = 300;

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
  } else {
    const count = await prisma.product.count({ where: { businessId } });
    if (count >= MAX_PRODUCTS) throw new Error(`Máximo ${MAX_PRODUCTS} productos por negocio`);
    const imageUrl = await resolveImage(businessId, input.imageUrl, null);
    await prisma.product.create({ data: { ...data, imageUrl, businessId, position: count } });
  }
  revalidatePath(`/dashboard/businesses/${businessId}/productos`);
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
