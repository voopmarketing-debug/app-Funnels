"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { deleteProduct, moveProduct, saveProduct } from "@/lib/productActions";

export type ManagedProduct = {
  id: string;
  kind: "PRODUCT" | "SERVICE";
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
  const [filter, setFilter] = useState<"ALL" | ManagedProduct["kind"]>("ALL");
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c))), [products]);
  const serviceCount = products.filter((p) => p.kind === "SERVICE").length;
  const productCount = products.length - serviceCount;
  const visible = products.filter(
    (p) =>
      (filter === "ALL" || p.kind === filter) &&
      (!query.trim() || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const filtering = !!query.trim() || filter !== "ALL";

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
          placeholder="Buscar en tu catálogo"
          aria-label="Buscar en tu catálogo"
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-surface px-3 text-base text-ink outline-none focus:border-accent md:text-sm"
        />
        <span className="text-sm text-ink-muted">
          {products.length} de {maxProducts}
        </span>
        <button
          type="button"
          onClick={() => open(null)}
          disabled={products.length >= maxProducts}
          title={products.length >= maxProducts ? `Llegaste al máximo de ${maxProducts}: elimina los que ya no vendes` : undefined}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          + Agregar producto o servicio
        </button>
      </div>

      {productCount > 0 && serviceCount > 0 && (
        <div role="tablist" aria-label="Filtrar catálogo" className="fl-seg">
          {(
            [
              ["ALL", "Todo", products.length],
              ["PRODUCT", "🛍️ Productos", productCount],
              ["SERVICE", "🗓️ Servicios", serviceCount],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className="fl-seg-item text-sm"
            >
              {label} <span className="fl-mono text-xs tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="fl-card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-4xl">🛍️</p>
          <p className="text-base font-semibold">Todavía no tienes nada en tu catálogo</p>
          <p className="max-w-md text-sm text-ink-muted">
            Agrega lo que vendes —productos o servicios— con foto y precio. Tu agente de IA los ofrece por WhatsApp y la IA puede crearte una
            tienda o una página de venta con ellos.
          </p>
          <button type="button" onClick={() => open(null)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Agregar el primero
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
                <span className="absolute bottom-2 left-2 flex gap-1">
                  <span className="rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
                    {p.kind === "SERVICE" ? "🗓️ Servicio" : "🛍️ Producto"}
                  </span>
                </span>
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
                  {!filtering && (
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

      <dialog ref={dialogRef} aria-label="Producto o servicio" className="w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl">
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

type Kind = ManagedProduct["kind"];

const KIND_COPY: Record<Kind, { icon: string; title: string; hint: string; namePlaceholder: string; categoryPlaceholder: string; descPlaceholder: string; badgePlaceholder: string }> = {
  PRODUCT: {
    icon: "🛍️",
    title: "Producto",
    hint: "Algo físico que entregas o envías",
    namePlaceholder: "Ej. Camiseta oversize negra",
    categoryPlaceholder: "Ej. Camisetas",
    descPlaceholder: "Material, tallas, tamaño, beneficios… Tu agente y tu web usan este texto.",
    badgePlaceholder: "Nuevo, Más vendido…",
  },
  SERVICE: {
    icon: "🗓️",
    title: "Servicio",
    hint: "Una cita, clase, sesión o trabajo",
    namePlaceholder: "Ej. Limpieza facial profunda",
    categoryPlaceholder: "Ej. Tratamientos faciales",
    descPlaceholder: "Qué incluye, cuánto dura, para quién es… Tu agente y tu web usan este texto.",
    badgePlaceholder: "Popular, Promo…",
  },
};

// Only digits are kept (no letters, signs or decimals): prices are whole
// pesos and units are whole units.
const onlyDigits = (v: string, max = 10) => v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, max);
const withThousands = (digits: string) => (digits ? Number(digits).toLocaleString("es-CO") : "");

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  money,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder: string;
  money?: boolean;
  hint?: string;
  id: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        {money && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">$</span>}
        <input
          id={id}
          value={withThousands(value)}
          onChange={(e) => onChange(onlyDigits(e.target.value, money ? 10 : 7))}
          onKeyDown={(e) => {
            // Letters never get in, not even for a frame.
            if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          className={`fl-mono w-full rounded-md border border-border bg-background py-2 pr-3 text-base tabular-nums text-ink outline-none focus:border-accent md:text-sm ${money ? "pl-7" : "pl-3"}`}
        />
      </div>
      {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
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
  const [kind, setKind] = useState<Kind>(product?.kind ?? "PRODUCT");
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
  const copy = KIND_COPY[kind];
  const isService = kind === "SERVICE";
  const noun = isService ? "servicio" : "producto";
  const discountTooHigh = compareAt !== "" && price !== "" && Number(compareAt) <= Number(price);

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

  const toNumber = (v: string) => (v ? Number(v) : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveProduct(businessId, product?.id ?? null, {
          kind,
          name,
          description,
          price: toNumber(price),
          compareAtPrice: toNumber(compareAt),
          category: category || null,
          badge: badge || null,
          imageUrl,
          active,
          trackStock: !isService && trackStock,
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
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-ink-faint";

  return (
    <form onSubmit={submit} className="flex max-h-[min(90dvh,52rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold">{product ? `Editar ${noun}` : "Agregar al catálogo"}</h2>
        <button type="button" onClick={onCancel} aria-label="Cerrar" className="h-8 w-8 rounded-full text-ink-muted hover:bg-surface-2">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <fieldset className="space-y-2">
          <legend className={sectionTitle}>¿Qué vas a {product ? "editar" : "agregar"}?</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_COPY) as Kind[]).map((k) => {
              const selected = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setKind(k)}
                  className={`fl-option flex items-start gap-3 rounded-xl border-2 p-3 text-left ${
                    selected ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {KIND_COPY[k].icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{KIND_COPY[k].title}</span>
                    <span className="block text-xs text-ink-muted">{KIND_COPY[k].hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <section className="space-y-3">
          <h3 className={sectionTitle}>Información</h3>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={imageUrl ? "Cambiar foto" : "Agregar foto"}
              className="relative flex h-24 w-24 flex-none flex-col sm:h-28 sm:w-28 items-center justify-center gap-1 overflow-hidden rounded-xl border border-dashed border-border-strong bg-background text-xs text-ink-muted hover:border-accent"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded photo
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : uploading !== null ? (
                `${uploading}%`
              ) : (
                <>
                  <span className="text-xl" aria-hidden="true">
                    📷
                  </span>
                  Agregar foto
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <label htmlFor="product-name" className="text-xs font-medium text-ink-muted">
                  Nombre del {noun} *
                </label>
                <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePlaceholder} required maxLength={120} className={input} />
              </div>
              <div className="space-y-1">
                <label htmlFor="product-category" className="text-xs font-medium text-ink-muted">
                  Categoría <span className="text-ink-faint">(opcional)</span>
                </label>
                <input
                  id="product-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={copy.categoryPlaceholder}
                  list="product-categories"
                  maxLength={60}
                  className={input}
                />
                <datalist id="product-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-ink-muted underline hover:text-error">
              Quitar foto
            </button>
          )}
          <div className="space-y-1">
            <label htmlFor="product-description" className="text-xs font-medium text-ink-muted">
              Descripción
            </label>
            <textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={copy.descPlaceholder}
              rows={3}
              maxLength={1200}
              className={`${input} resize-none`}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={sectionTitle}>Precio</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField id="product-price" label={isService ? "Precio del servicio" : "Precio de venta"} value={price} onChange={setPrice} placeholder="89.000" money />
            <NumberField id="product-compare" label="Precio antes (opcional)" value={compareAt} onChange={setCompareAt} placeholder="120.000" money />
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <label htmlFor="product-badge" className="text-xs font-medium text-ink-muted">
                Etiqueta (opcional)
              </label>
              <input id="product-badge" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder={copy.badgePlaceholder} maxLength={24} className={input} />
            </div>
          </div>
          <p className={`text-[11px] ${discountTooHigh ? "text-[var(--status-warn)]" : "text-ink-faint"}`}>
            {discountTooHigh
              ? "⚠ El precio antes debe ser mayor que el precio de venta para mostrarse tachado."
              : "Escribe solo el número: los puntos de miles se ponen solos. Déjalo vacío si el precio es a convenir."}
          </p>
        </section>

        {!isService && (
          <section className="space-y-3 rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              📦 Controlar inventario de este producto
            </label>
            {trackStock ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField id="product-stock" label="Unidades disponibles" value={stock} onChange={setStock} placeholder="0" />
                  <NumberField id="product-low" label="Avísame cuando queden" value={lowStockAt} onChange={setLowStockAt} placeholder="5" />
                </div>
                <p className="text-[11px] text-ink-faint">
                  Cada venta que registres en el CRM descuenta unidades. Agotado: tu web lo muestra como agotado y tu agente no lo ofrece.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-ink-faint">Déjalo apagado para productos que no se agotan.</p>
            )}
          </section>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Mostrar en mis páginas y que mi agente lo ofrezca
        </label>
      </div>

      <div className="space-y-2 border-t border-border px-5 py-4">
        {error && <p className="text-sm text-error">⚠ {error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || uploading !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando…" : `Guardar ${noun}`}
          </button>
        </div>
      </div>
    </form>
  );
}
