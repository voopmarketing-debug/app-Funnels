import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_CATALOG_PRODUCTS } from "@/lib/inventory";
import { ProductManager, type ManagedProduct } from "./ProductManager";

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true } } },
  });
  if (!membership) notFound();

  const products = await prisma.product.findMany({
    where: { businessId: id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const items: ManagedProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    badge: p.badge,
    imageUrl: p.imageUrl,
    active: p.active,
    trackStock: p.trackStock,
    stock: p.stock,
    lowStockAt: p.lowStockAt,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {membership.business.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Productos</h1>
        <p className="max-w-prose text-sm text-ink-muted">
          Tu catálogo: lo que aparece en tus páginas de tienda y de producto, con su botón de <strong className="text-ink">Pedir por WhatsApp</strong>.
          Tu agente de IA también lo conoce: responde precios y no ofrece lo que esté agotado. Hasta {MAX_CATALOG_PRODUCTS} productos.
        </p>
      </div>
      <ProductManager businessId={id} products={items} maxProducts={MAX_CATALOG_PRODUCTS} />
    </div>
  );
}
