"use client";

import { useState, useTransition } from "react";
import { updateWebsiteTracking } from "@/lib/actions";

/** "Píxel y medición": Meta Pixel + Google tag ids for running ads to this page. */
export function TrackingSettings({
  businessId,
  websiteId,
  metaPixelId,
  googleTagId,
}: {
  businessId: string;
  websiteId: string;
  metaPixelId: string | null;
  googleTagId: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ meta: string | null; google: string | null }>({ meta: metaPixelId, google: googleTagId });
  const [justSaved, setJustSaved] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    setJustSaved(false);
    start(async () => {
      const res = await updateWebsiteTracking(businessId, websiteId, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved({ meta: res.metaPixelId, google: res.googleTagId });
      setJustSaved(true);
    });
  }

  const active = [saved.meta && "Meta", saved.google && "Google"].filter(Boolean) as string[];

  return (
    <section id="pixel" className="scroll-mt-20 space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">📈 Píxel y medición para anuncios</p>
          <p className="text-xs text-ink-muted">
            Pega tus IDs para medir las campañas de Meta y Google que lleven a esta página.
          </p>
        </div>
        {active.length > 0 && (
          <span className="flex-none rounded-full bg-[var(--status-good)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--status-good)]">
            ● {active.join(" + ")}
          </span>
        )}
      </div>
      <form action={submit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor={`pixel-${websiteId}`} className="text-xs font-medium text-ink-muted">
            ID del Píxel de Meta (Facebook / Instagram)
          </label>
          <input
            id={`pixel-${websiteId}`}
            name="metaPixelId"
            inputMode="numeric"
            defaultValue={metaPixelId ?? ""}
            placeholder="Ej: 1234567890123456"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <p className="text-[11px] text-ink-faint">Lo encuentras en Meta → Administrador de eventos → tu píxel (solo números).</p>
        </div>
        <div className="space-y-1">
          <label htmlFor={`gtag-${websiteId}`} className="text-xs font-medium text-ink-muted">
            ID de Google (Analytics o Google Ads)
          </label>
          <input
            id={`gtag-${websiteId}`}
            name="googleTagId"
            defaultValue={googleTagId ?? ""}
            placeholder="Ej: G-ABC123XYZ o AW-123456789"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <p className="text-[11px] text-ink-faint">Google Analytics → Flujos de datos (G-…) o Google Ads → Etiqueta de Google (AW-…).</p>
        </div>
        {error && <p className="text-xs font-medium text-error">⚠ {error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {justSaved && !pending && <span className="text-xs font-medium text-accent">✓ Guardado, ya está activo en tu página</span>}
        </div>
      </form>
      <details className="text-xs text-ink-muted">
        <summary className="cursor-pointer font-medium text-ink">¿Qué se mide automáticamente?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong className="text-ink">Visitas</strong> a la página (PageView / page_view).
          </li>
          <li>
            <strong className="text-ink">Clics a WhatsApp</strong> o a tus botones (Contact / contact).
          </li>
          <li>
            <strong className="text-ink">Formularios enviados</strong> (Lead / generate_lead) y <strong className="text-ink">citas agendadas</strong> (Schedule).
          </li>
        </ul>
        <p className="mt-2">
          Úsalos como conversión en tus campañas. Las visitas que haces tú desde la vista previa del editor no se cuentan.
        </p>
      </details>
    </section>
  );
}
