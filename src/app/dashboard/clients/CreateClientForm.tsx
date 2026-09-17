"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClientAccount, type CreateClientState } from "@/lib/actions";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

const INITIAL_STATE: CreateClientState = { error: null, success: null };

// The agency creating a client's account has no plan cap to hit (see the
// "sin límite" note in createClientAccount) — this is the admin-only path
// Juan asked for, distinct from "+ Nuevo agente de IA" which always makes
// the CALLER the owner and is subject to their own plan's line limit.
export function CreateClientForm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover"
      >
        + Crear cliente
      </button>

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-sm p-0">
        <CreateClientDialogContent key={formKey} onClose={() => dialogRef.current?.close()} />
      </dialog>
    </>
  );
}

function CreateClientDialogContent({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createClientAccount, INITIAL_STATE);
  const [copied, setCopied] = useState(false);

  if (state.success) {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-ink">Cliente creado</h2>
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{state.success.businessName}</span> ya tiene cuenta. Copia la
            contraseña y envíasela al cliente por WhatsApp — no queda guardada en ningún lado, solo se muestra aquí
            una vez.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <code className="fl-mono flex-1 text-sm text-accent">{state.success.password}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.success!.password);
              setCopied(true);
            }}
            className="text-xs font-medium text-ink-muted hover:text-ink"
          >
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Link
            href={`/dashboard/businesses/${state.success.businessId}`}
            className="rounded-md border border-border-strong px-4 py-2 text-center text-sm font-medium text-ink transition hover:border-accent"
          >
            Ver negocio
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">Crear cuenta de cliente</h2>
        <p className="text-sm text-ink-muted">
          Sin límite de líneas ni de plan — esta cuenta arranca desde cero, así que el tope de un plan no aplica
          todavía.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="businessName" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre del negocio
        </label>
        <input
          id="businessName"
          name="businessName"
          required
          placeholder="Clínica Sonrisa"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="industry" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Tipo de negocio
        </label>
        <select
          id="industry"
          name="industry"
          defaultValue="otro"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        >
          {INDUSTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="clientName" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre del cliente
        </label>
        <input
          id="clientName"
          name="clientName"
          required
          placeholder="María Pérez"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Teléfono / WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="+57 300 123 4567"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Creando..." : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
