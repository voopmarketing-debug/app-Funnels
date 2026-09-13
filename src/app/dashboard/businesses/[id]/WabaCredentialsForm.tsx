"use client";

import { useActionState } from "react";
import { updateWabaCredentials } from "@/lib/actions";

type SaveState = { saved: boolean };

export function WabaCredentialsForm({
  businessId,
  wabaPhoneNumberId,
}: {
  businessId: string;
  wabaPhoneNumberId: string;
}) {
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    async (_prevState, formData) => {
      await updateWabaCredentials(businessId, formData);
      return { saved: true };
    },
    { saved: false },
  );

  return (
    <details className="rounded-md border border-border bg-surface p-4">
      <summary className="cursor-pointer fl-mono text-xs tracking-wide text-ink-muted uppercase">
        Credenciales de WhatsApp (actualizar si el token venció)
      </summary>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="space-y-1">
          <label htmlFor="wabaPhoneNumberId" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Phone Number ID
          </label>
          <input
            id="wabaPhoneNumberId"
            name="wabaPhoneNumberId"
            defaultValue={wabaPhoneNumberId}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="wabaAccessToken" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Token de acceso nuevo
          </label>
          <input
            id="wabaAccessToken"
            name="wabaAccessToken"
            type="password"
            placeholder="Pega aquí el token generado en Meta"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Actualizar token"}
          </button>
          {state.saved && !isPending && (
            <span className="fl-mono text-xs text-accent">✓ Token actualizado</span>
          )}
        </div>
      </form>
    </details>
  );
}
