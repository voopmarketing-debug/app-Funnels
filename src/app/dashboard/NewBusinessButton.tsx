"use client";

import Link from "next/link";
import { useRef } from "react";
import type { PlanTier } from "@prisma/client";
import { PLAN_LABELS } from "@/lib/plans";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

const BUTTON_CLASS =
  "rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover";

// Shown once a client's account has reached its plan's WhatsApp-line cap
// (see getAccountLineStatus) — a pop-up instead of the create-business form,
// so hitting the wall doesn't feel like a broken page, and points them at
// upgrading or talking to the agency instead.
export function NewBusinessButton({
  atLimit,
  limit,
  count,
  planTier,
}: {
  atLimit: boolean;
  limit: number | null;
  count: number;
  planTier: PlanTier;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!atLimit) {
    return (
      <Link href="/dashboard/businesses/new" className={BUTTON_CLASS}>
        + Nuevo agente de IA
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={BUTTON_CLASS}>
        + Nuevo agente de IA
      </button>

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-sm p-0">
        <div className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-2xl">
            🔒
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">Llegaste al límite de tu plan</h2>
            <p className="text-sm text-ink-muted">
              Tu plan <span className="font-semibold text-ink">{PLAN_LABELS[planTier]}</span> permite hasta {limit}{" "}
              {limit === 1 ? "línea" : "líneas"} de WhatsApp, y ya tienes {count}. Actualiza de plan o escríbenos y
              te ayudamos a agregar más.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              Hablar con soporte
            </a>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
            >
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
