"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createWebsiteFromTemplate } from "@/lib/actions";
import { NICHE_TEMPLATES, type NicheTemplate } from "@/lib/websiteNicheTemplates";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";
import { DevicePreviewFrame } from "@/components/DevicePreviewFrame";

type Card = Pick<NicheTemplate, "id" | "niche" | "emoji" | "tagline" | "includes">;

/**
 * "Plantillas listas": landing pages already written for a kind of business. Choosing one creates
 * the page at once (no AI, no cost) and opens it in the builder to edit.
 */
export function TemplateGallery({
  businessId,
  needsWhatsapp,
  onChooseAI,
}: {
  businessId: string;
  needsWhatsapp: boolean;
  onChooseAI: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [big, setBig] = useState<Card | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [, startTransition] = useTransition();
  const cards: Card[] = NICHE_TEMPLATES;
  const previewSrc = (id: string) => `/dashboard/businesses/${businessId}/website/muestra?template=${id}`;
  const digits = whatsapp.replace(/\D/g, "");
  const whatsappMissing = needsWhatsapp && (digits.length < 8 || digits.length > 15);

  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big]);

  function use(card: Card) {
    if (busy) return;
    if (whatsappMissing) {
      setBig(null);
      setError("Escribe tu WhatsApp para que los botones de la página te lleven a él.");
      document.getElementById("template-whatsapp")?.focus();
      document.getElementById("template-whatsapp")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    setBusy(card.id);
    startTransition(async () => {
      try {
        const result = await createWebsiteFromTemplate(businessId, { templateId: card.id, whatsappNumber: needsWhatsapp ? whatsapp : undefined });
        if (!result.ok) throw new Error(result.error);
        router.push(`/dashboard/businesses/${businessId}/website/${result.id}`);
      } catch (err) {
        setBusy(null);
        setBig(null);
        setError(err instanceof Error ? err.message : "No se pudo crear la página");
      }
    });
  }

  if (busy) {
    const card = cards.find((c) => c.id === busy);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-3xl text-accent-ink">{card?.emoji ?? "✦"}</span>
        <div>
          <h1 className="text-xl font-bold">Creando tu página</h1>
          <p className="mt-1 text-sm text-ink-muted">Un momento, ya casi: la abrimos para que la edites.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/dashboard/businesses/${businessId}/website`} className="text-sm text-ink-muted underline hover:text-ink">
          ← Sitios web
        </Link>
        <h1 className="mt-1 text-xl font-bold">Elige una plantilla lista</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Ya vienen escritas para tu tipo de negocio y con tu nombre. Se crean al instante, sin esperar a la IA y sin costo; después cambias lo que quieras.
        </p>
      </div>

      {needsWhatsapp && (
        <label className="fl-card block max-w-xl space-y-1.5 p-4">
          <span className="block text-sm font-semibold text-ink">¿A qué WhatsApp te van a escribir tus clientes?</span>
          <input
            id="template-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+57 300 123 4567"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm"
          />
          <span className="block text-xs text-ink-muted">Todos los botones de tu página llevan a este número. Lo guardamos en tu perfil.</span>
        </label>
      )}

      {error && <p className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.id} className="fl-card flex flex-col overflow-hidden">
            <button type="button" onClick={() => setBig(card)} className="block text-left" aria-label={`Ver en grande: ${card.niche}`}>
              <ScaledPagePreview src={previewSrc(card.id)} aspect={0.7} title={`Plantilla para ${card.niche}`} />
            </button>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-base font-bold text-ink">
                <span aria-hidden="true">{card.emoji} </span>
                {card.niche}
              </p>
              <p className="text-sm text-ink-muted">{card.tagline}</p>
              <ul className="space-y-0.5 text-xs text-ink-muted">
                {card.includes.map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-1.5 pt-3">
                <button type="button" onClick={() => use(card)} className="rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                  Usar esta plantilla
                </button>
                <button type="button" onClick={() => setBig(card)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent">
                  Ver en grande
                </button>
              </div>
            </div>
          </article>
        ))}

        <article className="fl-card flex flex-col justify-center gap-3 border-dashed p-5">
          <p className="text-base font-bold text-ink">✦ ¿Tu negocio es otro?</p>
          <p className="text-sm text-ink-muted">Cuéntale a la IA qué vendes y te propone ideas y arma tu página desde cero con tus productos, tus fotos y tus colores.</p>
          <button type="button" onClick={onChooseAI} className="rounded-lg border border-border-strong px-3 py-2.5 text-sm font-semibold hover:border-accent">
            Crear con IA
          </button>
        </article>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label={`Vista previa: ${big.niche}`}>
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 pb-3">
            <div className="inline-flex rounded-lg border border-white/20 bg-black/40 p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${device === d ? "bg-white text-black" : "text-white/80"}`}>
                  {d === "desktop" ? "Computador" : "Celular"}
                </button>
              ))}
            </div>
            <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white">{big.niche}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => use(big)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                Usar esta plantilla
              </button>
              <button type="button" onClick={() => setBig(null)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">
                Ver otras
              </button>
            </div>
          </div>
          <div className={`mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-white ${device === "mobile" ? "max-w-[390px]" : "max-w-6xl"}`}>
            <DevicePreviewFrame src={previewSrc(big.id)} device={device} />
          </div>
        </div>
      )}
    </div>
  );
}
