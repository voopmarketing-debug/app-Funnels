"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getConversationSales, registerSale } from "@/lib/saleActions";
import type { SaleProductOption, SaleRow } from "@/lib/sales";

const OTHER = "__other__";

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
}

function withThousands(digits: string): string {
  return digits ? Number(digits).toLocaleString("es-CO") : "";
}

/**
 * "Registrar venta" for one contact: value, product (from the catalog or
 * typed) and an optional note. Opened from the contact's ficha, the chat
 * header on phones, and right after moving a lead to a "Ganado" stage
 * (then `reason` says why it popped up, and closing it just skips it).
 */
export function SaleDialog({
  businessId,
  conversationId,
  open,
  onClose,
  onSaved,
  reason,
}: {
  businessId: string;
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (sale: SaleRow) => void;
  reason?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [products, setProducts] = useState<SaleProductOption[] | null>(null);
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The catalog loads once, the first time the dialog opens.
  useEffect(() => {
    if (!open || products) return;
    let cancelled = false;
    getConversationSales(businessId, conversationId).then((res) => {
      if (cancelled) return;
      const list = res.ok ? res.products : [];
      setProducts(list);
      if (list.length === 0) setProductId(OTHER);
    });
    return () => {
      cancelled = true;
    };
  }, [open, products, businessId, conversationId]);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products?.find((x) => x.id === id);
    if (p?.price) setAmount(String(p.price));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registerSale(businessId, conversationId, {
        amount: Number(amount),
        productId: productId && productId !== OTHER ? productId : null,
        productName: productId === OTHER ? productName : null,
        note,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAmount("");
      setNote("");
      setProductName("");
      setProductId(products && products.length > 0 ? "" : OTHER);
      onSaved?.(res.sale);
      onClose();
    });
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";

  return (
    <dialog ref={dialogRef} onClose={onClose} className="fl-card-hero w-[calc(100%-2rem)] max-w-md p-0">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">💰 Registrar venta</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {reason ?? "Suma a tus KPIs de ventas: ingresos, ticket promedio y lo que generó tu agente de IA."}
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Producto o servicio</span>
          {products === null ? (
            <div className="h-10 animate-pulse rounded-md bg-surface-2" />
          ) : (
            <select value={productId} onChange={(e) => pickProduct(e.target.value)} className={inputClass}>
              {products.length > 0 && <option value="">Elige del catálogo…</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.price ? ` · $${p.price.toLocaleString("es-CO")}` : ""}
                </option>
              ))}
              <option value={OTHER}>Otro (escribirlo)</option>
            </select>
          )}
        </label>

        {productId === OTHER && (
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            maxLength={120}
            placeholder="Ej. Consulta de valoración, Plan mensual…"
            aria-label="Nombre del producto o servicio"
            className={inputClass}
          />
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Valor de la venta *</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">$</span>
            <input
              required
              inputMode="numeric"
              value={withThousands(amount)}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
              placeholder="150.000"
              className={`${inputClass} fl-mono pl-7 tabular-nums`}
            />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Nota (opcional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Ej. Pagó por transferencia, 2 unidades"
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm font-medium text-error">⚠ {error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-ink-muted hover:text-ink">
            {reason ? "Ahora no" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={isPending || !amount}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando…" : "Registrar venta"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** "💰 Venta" in the chat header on phones, where the ficha isn't shown. */
export function SaleButton({ businessId, conversationId, className }: { businessId: string; conversationId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        💰 Venta
      </button>
      <SaleDialog businessId={businessId} conversationId={conversationId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
