"use client";

import { useRef, useState, useTransition } from "react";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { ADDON_PACKS, ADDON_DURATION_DAYS, formatCop, type AddonKind } from "@/lib/addonPacks";
import { startAddonCheckout } from "@/lib/addonActions";

/**
 * "Comprar más contactos / líneas": a button that opens the pack catalog.
 * Buying goes to Mercado Pago; the webhook activates the pack on the
 * account as soon as the payment is approved — no manual step.
 */
export function AddonStore({
  businessId,
  kind,
  label,
  className,
}: {
  businessId: string;
  // Only show one kind of pack (e.g. lines from the "Nueva línea" limit).
  kind?: AddonKind;
  label: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const packs = ADDON_PACKS.filter((p) => !p.retired && (!kind || p.kind === kind));

  function buy(packKey: string) {
    setError(null);
    setBuyingKey(packKey);
    startTransition(async () => {
      try {
        const result = await startAddonCheckout(businessId, packKey);
        if (result.kind === "support") {
          window.open(result.url, "_blank", "noopener,noreferrer");
          setBuyingKey(null);
        } else {
          window.location.href = result.url;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
        setBuyingKey(null);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          className ??
          "block w-full rounded-md bg-accent px-3 py-2 text-center text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
        }
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Paquetes adicionales"
        className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{kind === "LINE" ? "Agrega otra línea de WhatsApp" : "Amplía tu capacidad"}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Pago único con Mercado Pago. Se activa solo apenas se aprueba el pago y dura {ADDON_DURATION_DAYS} días.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {packs.map((pack) => (
            <article
              key={pack.key}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 ${pack.highlight ? "border-accent bg-accent/5" : "border-border bg-background"}`}
            >
              {pack.highlight && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                  Más elegido
                </span>
              )}
              <h3 className="text-base font-bold">{pack.title}</h3>
              <p className="text-sm text-ink-muted">{pack.description}</p>
              <p className="mt-auto pt-2 text-xl font-bold">{formatCop(pack.priceCop)}</p>
              <p className="-mt-1 text-xs text-ink-faint">
                por {ADDON_DURATION_DAYS} días
                {pack.kind === "CONTACTS" && ` · $${Math.round(pack.priceCop / pack.quantity).toLocaleString("es-CO")} por cliente`}
              </p>
              <button
                type="button"
                onClick={() => buy(pack.key)}
                disabled={isPending}
                className={`mt-1 rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                  pack.highlight ? "bg-accent text-accent-ink hover:bg-accent-hover" : "border border-border-strong text-ink hover:border-accent hover:text-accent"
                }`}
              >
                {buyingKey === pack.key ? "Abriendo pago…" : "Comprar"}
              </button>
            </article>
          ))}
        </div>
        {error && <p className="px-5 pb-4 text-sm text-error">{error}</p>}
        <p className="border-t border-border px-5 py-3 text-xs text-ink-faint">
          Tu CRM guarda contactos ilimitados. El cupo cuenta cada cliente distinto que atiende la IA en el mes (con todas sus respuestas). Los paquetes se suman a tu plan mientras estén vigentes.
          {kind !== "LINE" && (
            <span className="mt-1 block text-ink-muted">
              ¿Necesitas más de 500 cada mes? El plan <strong className="text-ink">Pro</strong> trae 1.200 clientes y 3 líneas por $1.190.000/mes.{" "}
              <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                Te conviene: escríbenos
              </a>
            </span>
          )}
        </p>
      </dialog>
    </>
  );
}
