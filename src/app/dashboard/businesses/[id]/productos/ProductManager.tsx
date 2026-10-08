"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { deleteProduct, moveProduct, saveProduct } from "@/lib/productActions";

export type ManagedProduct = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  category: string | null;
  badge: string | null;
  imageUrl: string | null;
  active: boolean;
  trackStock: boolean;
  stock: number;
  lowStockAt: number;
};

const money = (v: number | null) => (v === null ? "" : `$${v.toLocaleString("es-CO")}`);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "foto";
}

export function ProductManager({ businessId, products, maxProducts }: { businessId: string; products: ManagedProduct[]; maxProducts: number }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<ManagedProduct | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c))), [products]);
  const visible = products.filter((p) => !query.trim() || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  function open(product: ManagedProduct | null) {
    setEditing(product);
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }

  function remove(p: ManagedProduct) {
    if (!confirm(`¿Eliminar "${p.name}"? Dejará de aparecer en tus páginas.`)) return;
    startTransition(async () => {
      await deleteProduct(businessId, p.id);
      router.refresh();
    });
  }

  function move(p: ManagedProduct, dir: -1 | 1) {
    startTransition(async () => {
      await moveProduct(businessId, p.id, dir);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-surface px-3 text-base text-ink outline-none focus:border-accent md:text-sm"
        />
        <span className="text-sm text-ink-muted">
          {products.length} de {maxProducts} productos
        </span>
        <button
          type="button"
          onClick={() => open(null)}
          disabled={products.length >= maxProducts}
          title={products.length >= maxProducts ? `Llegaste al máximo de ${maxProducts} productos: elimina los que ya no vendes` : undefined}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          + Agregar producto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="fl-card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-4xl">🛍️</p>
          <p className="text-base font-semibold">Todavía no tienes productos</p>
          <p className="max-w-md text-sm text-ink-muted">
            Agrega tus productos con foto y precio. Con ellos la IA puede crearte una tienda o una página de venta de producto.
          </p>
          <button type="button" onClick={() => open(null)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Agregar mi primer producto
          </button>
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${isPending ? "opacity-70" : ""}`}>
          {visible.map((p) => (
            <article key={p.id} className="fl-card group flex flex-col overflow-hidden">
              <button type="button" onClick={() => open(p)} className="relative block aspect-square bg-surface-2 text-left">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted product photo
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-4xl font-bold text-ink-faint">{p.name.slice(0, 1)}</span>
                )}
                {p.badge && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-background">{p.badge}</span>}
                {!p.active && <span className="absolute right-2 top-2 rounded-full bg-error px-2 py-0.5 text-[11px] font-bold text-white">Oculto</span>}
                {p.active && p.trackStock && (
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      p.stock <= 0 ? "bg-error text-white" : p.stock <= p.lowStockAt ? "bg-[var(--status-warn)] text-black" : "bg-surface/90 text-ink"
                    }`}
                  >
                    {p.stock <= 0 ? "Agotado" : `${p.stock.toLocaleString("es-CO")} und.`}
                  </span>
                )}
              </button>
              <div className="flex flex-1 flex-col gap-1 p-3">
                {p.category && <p className="text-[11px] uppercase tracking-wide text-ink-faint">{p.category}</p>}
                <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
                <p className="text-sm">
                  <span className="font-bold">{p.price === null ? "Sin precio" : money(p.price)}</span>
                  {p.compareAtPrice && p.price !== null && p.compareAtPrice > p.price && (
                    <span className="ml-1.5 text-xs text-ink-faint line-through">{money(p.compareAtPrice)}</span>
                  )}
                </p>
                <div className="mt-auto flex items-center gap-1 pt-2">
                  <button type="button" onClick={() => open(p)} className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:border-accent hover:text-accent">
                    Editar
                  </button>
                  {!query && (
                    <>
                      <button type="button" onClick={() => move(p, -1)} aria-label="Mover antes" className="rounded-md border border-border px-2 py-1 text-xs hover:border-accent">↑</button>
                      <button type="button" onClick={() => move(p, 1)} aria-label="Mover después" className="rounded-md border border-border px-2 py-1 text-xs hover:border-accent">↓</button>
                    </>
                  )}
                  <button type="button" onClick={() => remove(p)} aria-label={`Eliminar ${p.name}`} className="rounded-md border border-border px-2 py-1 text-xs text-error hover:border-error">✕</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <dialog ref={dialogRef} aria-label="Producto" className="w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl">
        <ProductForm
          key={formKey}
          businessId={businessId}
          product={editing}
          categories={categories}
          onDone={() => {
            dialogRef.current?.close();
            router.refresh();
          }}
          onCancel={() => dialogRef.current?.close()}
        />
      </dialog>
    </div>
  );
}

function ProductForm({
  businessId,
  product,
  categories,
  onDone,
  onCancel,
}: {
  businessId: string;
  product: ManagedProduct | null;
  categories: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [compareAt, setCompareAt] = useState(product?.compareAtPrice?.toString() ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [badge, setBadge] = useState(product?.badge ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false);
  const [stock, setStock] = useState(product?.trackStock ? String(product.stock) : "");
  const [lowStockAt, setLowStockAt] = useState(String(product?.lowStockAt ?? 5));
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Elige una imagen (JPG, PNG o WebP)");
    if (file.size > MAX_IMAGE_BYTES) return setError("La foto pesa más de 5 MB");
    setUploading(0);
    try {
      const blob = await upload(`products/${businessId}/${safeName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/attachments/upload",
        clientPayload: JSON.stringify({ businessId }),
        contentType: file.type,
        onUploadProgress: ({ percentage }) => setUploading(Math.round(percentage)),
      });
      setImageUrl(blob.url);
    } catch (err) {
      setError(`No se pudo subir la foto (${err instanceof Error ? err.message : "error"})`);
    } finally {
      setUploading(null);
    }
  }

  const toNumber = (v: string) => {
    const digits = v.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveProduct(businessId, product?.id ?? null, {
          name,
          description,
          price: toNumber(price),
          compareAtPrice: toNumber(compareAt),
          category: category || null,
          badge: badge || null,
          imageUrl,
          active,
          trackStock,
          stock: toNumber(stock),
          lowStockAt: toNumber(lowStockAt),
        });
        if (!result.ok) throw new Error(result.error);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{product ? "Editar producto" : "Nuevo producto"}</h2>
        <button type="button" onClick={onCancel} aria-label="Cerrar" className="h-8 w-8 rounded-full text-ink-muted hover:bg-surface-2">✕</button>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-28 w-28 flex-none items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-background text-xs text-ink-muted hover:border-accent"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded photo
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : uploading !== null ? (
            `${uploading}%`
          ) : (
            "+ Foto"
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
        <div className="min-w-0 flex-1 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto *" required maxLength={120} className={input} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoría (ej. Camisetas)" list="product-categories" maxLength={60} className={input} />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      {imageUrl && (
        <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-ink-muted underline hover:text-error">
          Quitar foto
        </button>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción: material, tamaño, beneficios… (la IA la usa para escribir la página)"
        rows={3}
        maxLength={1200}
        className={`${input} resize-none`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-ink-muted">Precio (COP)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="89000" className={input} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-ink-muted">Precio antes (opcional)</span>
          <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} inputMode="numeric" placeholder="120000" className={input} />
        </label>
        <label className="col-span-2 space-y-1 sm:col-span-1">
          <span className="text-xs text-ink-muted">Etiqueta (opcional)</span>
          <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Nuevo, Más vendido…" maxLength={24} className={input} />
        </label>
      </div>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          📦 Controlar inventario de este producto
        </label>
        {trackStock ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-ink-muted">Unidades disponibles</span>
              <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" placeholder="0" className={input} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-ink-muted">Avísame cuando queden</span>
              <input value={lowStockAt} onChange={(e) => setLowStockAt(e.target.value)} inputMode="numeric" placeholder="5" className={input} />
            </label>
            <p className="col-span-2 text-[11px] text-ink-faint">
              Cada venta que registres en el CRM descuenta unidades. Agotado: tu web lo muestra como agotado y tu agente no lo ofrece.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-ink-faint">Déjalo apagado para servicios o productos que no se agotan.</p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        Mostrar en mis páginas
      </label>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium">
          Cancelar
        </button>
        <button type="submit" disabled={isPending || uploading !== null} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {isPending ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
