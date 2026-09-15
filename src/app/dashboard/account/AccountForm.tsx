"use client";

import { useActionState } from "react";
import { updateOwnProfile, type UpdateProfileState } from "@/lib/actions";

export function AccountForm({
  email,
  name,
  phone,
  city,
  country,
  facebook,
  instagram,
  tiktok,
  linkedin,
}: {
  email: string;
  name: string;
  phone: string;
  city: string;
  country: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  linkedin: string;
}) {
  const [state, formAction, isPending] = useActionState<UpdateProfileState, FormData>(
    updateOwnProfile,
    { error: null, saved: false },
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="space-y-1">
        <label className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Email</label>
        <p className="rounded-md border border-border bg-background px-3 py-2 text-ink-muted">{email}</p>
        <p className="text-xs text-ink-muted">El correo de acceso no se puede cambiar aquí.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
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
          defaultValue={phone}
          placeholder="+57 300 123 4567"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="city" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Ciudad
          </label>
          <input
            id="city"
            name="city"
            defaultValue={city}
            placeholder="Bogotá"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="country" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            País
          </label>
          <input
            id="country"
            name="country"
            defaultValue={country}
            placeholder="Colombia"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Redes sociales</p>

        <div className="space-y-1">
          <label htmlFor="instagram" className="text-xs text-ink-muted">
            Instagram
          </label>
          <input
            id="instagram"
            name="instagram"
            defaultValue={instagram}
            placeholder="@negocio"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="facebook" className="text-xs text-ink-muted">
            Facebook
          </label>
          <input
            id="facebook"
            name="facebook"
            defaultValue={facebook}
            placeholder="facebook.com/negocio"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="tiktok" className="text-xs text-ink-muted">
            TikTok
          </label>
          <input
            id="tiktok"
            name="tiktok"
            defaultValue={tiktok}
            placeholder="@negocio"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="linkedin" className="text-xs text-ink-muted">
            LinkedIn
          </label>
          <input
            id="linkedin"
            name="linkedin"
            defaultValue={linkedin}
            placeholder="linkedin.com/company/negocio"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <p className="text-xs text-ink-muted">
          Ciudad, país y redes le dan contexto a tu agente de IA — así puede responder si un cliente
          pregunta dónde están o si tienen Instagram, sin que tengas que escribirlo tú en el prompt.
        </p>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        {state.saved && !isPending && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
      </div>
    </form>
  );
}
