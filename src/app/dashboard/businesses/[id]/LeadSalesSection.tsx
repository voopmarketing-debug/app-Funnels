"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteSale, getConversationSales } from "@/lib/saleActions";
import type { SaleRow } from "@/lib/sales";
import { SaleDialog } from "./SaleDialog";

function money(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

/** "Ventas" block of the contact's ficha: what this contact has bought. */
export function LeadSalesSection({ businessId, conversationId }: { businessId: string; conversationId: string }) {
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getConversationSales(businessId, conversationId).then((res) => {
      if (!cancelled) setSales(res.ok ? res.sales : []);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, conversationId]);

  function remove(sale: SaleRow) {
    if (!confirm(`¿Borrar la venta de ${money(sale.amount)}?`)) return;
    setSales((prev) => prev?.filter((s) => s.id !== sale.id) ?? null);
    startTransition(async () => {
      const res = await deleteSale(businessId, sale.id);
      if (!res.ok) setSales((prev) => (prev ? [sale, ...prev] : [sale]));
    });
  }

  const total = sales?.reduce((sum, s) => sum + s.amount, 0) ?? 0;

  return (
    <section className="border-b border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Ventas</h3>
        {sales && sales.length > 0 && <span className="fl-mono text-xs font-semibold text-[var(--status-good)]">{money(total)}</span>}
      </div>

      {sales === null ? (
        <div className="h-8 animate-pulse rounded-md bg-surface-2" />
      ) : sales.length === 0 ? (
        <p className="px-2 text-[13px] text-ink-faint">Cuando este cliente te compre, regístralo aquí para ver tus ventas en KPIs.</p>
      ) : (
        <ul className="space-y-1">
          {sales.map((s) => (
            <li key={s.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="fl-mono text-sm font-semibold tabular-nums text-ink">{money(s.amount)}</p>
                <p className="truncate text-xs text-ink-muted">
                  {s.quantity > 1 ? `${s.quantity} × ` : ""}
                  {s.productName ?? "Venta"} · {new Date(s.closedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                  {s.aiAssisted && <span className="ml-1 text-accent">· con IA</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label="Borrar venta"
                title="Borrar venta"
                className="flex-none rounded px-1.5 text-ink-faint opacity-0 transition hover:text-error group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-md border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
      >
        💰 Registrar venta
      </button>

      <SaleDialog
        businessId={businessId}
        conversationId={conversationId}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(sale) => setSales((prev) => [sale, ...(prev ?? [])])}
      />
    </section>
  );
}
