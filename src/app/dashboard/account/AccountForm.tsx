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
    <form action={formAction} className="fl-card space-y-6 p-5 sm:p-6">
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Tus datos</h2>
          <p className="text-xs text-ink-muted">Con estos datos te contactamos sobre tu cuenta.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-xs font-medium text-ink-muted">Correo de acceso</span>
            <p className="truncate rounded-md border border-border bg-surface-2/60 px-3 py-2 text-ink-muted" title={email}>
              {email}
            </p>
            <p className="text-[11px] text-ink-faint">No se puede cambiar aquí.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="name" className="text-xs font-medium text-ink-muted">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name} required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="phone" className="text-xs font-medium text-ink-muted">
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
            <label htmlFor="city" className="text-xs font-medium text-ink-muted">
              Ciudad
            </label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={city}
              placeholder="Bogotá"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="country" className="text-xs font-medium text-ink-muted">
              País
            </label>
            <input
              id="country"
              name="country"
              type="text"
              defaultValue={country}
              placeholder="Colombia"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-5">
        <div>
          <h2 className="font-semibold text-ink">Redes sociales</h2>
          <p className="text-xs text-ink-muted">
            Ciudad, país y redes le dan contexto a tu agente de IA: así responde si un cliente pregunta dónde están o si tienen
            Instagram, sin que lo escribas en sus instrucciones.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="instagram" className="text-xs font-medium text-ink-muted">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              type="text"
              defaultValue={instagram}
              placeholder="@negocio"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="facebook" className="text-xs font-medium text-ink-muted">
              Facebook
            </label>
            <input
              id="facebook"
              name="facebook"
              type="text"
              defaultValue={facebook}
              placeholder="facebook.com/negocio"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tiktok" className="text-xs font-medium text-ink-muted">
              TikTok
            </label>
            <input
              id="tiktok"
              name="tiktok"
              type="text"
              defaultValue={tiktok}
              placeholder="@negocio"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="linkedin" className="text-xs font-medium text-ink-muted">
              LinkedIn
            </label>
            <input
              id="linkedin"
              name="linkedin"
              type="text"
              defaultValue={linkedin}
              placeholder="linkedin.com/company/negocio"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
        </div>
      </section>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-5 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        {state.saved && !isPending && <span className="text-sm font-medium text-accent">✓ Guardado</span>}
      </div>
    </form>
  );
}
