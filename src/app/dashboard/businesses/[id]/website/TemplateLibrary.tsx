"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createBlankWebsite, createWebsiteFromTemplate } from "@/lib/actions";
import type { TemplateCard } from "@/lib/websiteNicheTemplates";
import { DevicePreviewFrame } from "@/components/DevicePreviewFrame";
import { TemplateThumb } from "./TemplateThumb";
import { HtmlUploadDialog } from "./HtmlUploadDialog";

const PAGE = 24;
const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Tone = "all" | "light" | "dark";

/**
 * The first screen of "Sitio web": niches on the left, templates on the right (like the design
 * libraries of Elementor or WordPress). "Ver página" shows one in full; "Publicar" creates it at
 * once, with no AI and no cost, and opens the builder to edit it.
 */
export function TemplateLibrary({
  businessId,
  cards,
  needsWhatsapp,
  hasDraft,
  onChooseAI,
}: {
  businessId: string;
  cards: TemplateCard[];
  needsWhatsapp: boolean;
  hasDraft: boolean;
  onChooseAI: () => void;
}) {
  const router = useRouter();
  const [niche, setNiche] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<Tone>("all");
  const [limit, setLimit] = useState(PAGE);
  const [big, setBig] = useState<TemplateCard | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState<TemplateCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [blankBusy, setBlankBusy] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [, startTransition] = useTransition();

  const niches = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; short: string; emoji: string; count: number }>();
    for (const c of cards) {
      const n = seen.get(c.nicheId) ?? { id: c.nicheId, name: c.nicheName, short: c.nicheShort, emoji: c.emoji, count: 0 };
      n.count++;
      seen.set(c.nicheId, n);
    }
    return [...seen.values()];
  }, [cards]);

  const shown = useMemo(() => {
    const q = plain(query.trim());
    return cards.filter((c) => {
      if (niche !== "all" && c.nicheId !== niche) return false;
      if (tone === "dark" && !c.dark) return false;
      if (tone === "light" && c.dark) return false;
      if (q && !plain(`${c.nicheName} ${c.name} ${c.heading} ${c.strategy} ${c.eyebrow}`).includes(q)) return false;
      return true;
    });
  }, [cards, niche, query, tone]);

  const visible = shown.slice(0, limit);
  const digits = whatsapp.replace(/\D/g, "");
  const whatsappMissing = needsWhatsapp && (digits.length < 8 || digits.length > 15);
  const previewSrc = (id: string) => `/dashboard/businesses/${businessId}/website/muestra?template=${id}`;
  const label = (c: TemplateCard) => `${c.number} · ${c.name}`;
  // Funnels are created as drafts (they need the owner's own video, date or testimonials first).
  const isFunnel = (c: TemplateCard) => c.nicheId === "embudos";
  const actionLabel = (c: TemplateCard) => (isFunnel(c) ? "Crear embudo" : "Publicar");

  useEffect(() => {
    if (!big) return;
    const idx = shown.findIndex((c) => c.id === big.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBig(null);
      if (e.key === "ArrowRight" && idx >= 0 && shown[idx + 1]) setBig(shown[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) setBig(shown[idx - 1]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big, shown]);

  function publish(card: TemplateCard) {
    if (busy) return;
    if (whatsappMissing) {
      setBig(null);
      setError("Escribe tu WhatsApp para que los botones de la página te lleven a él.");
      document.getElementById("template-whatsapp")?.focus();
      document.getElementById("template-whatsapp")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    setBusy(card);
    startTransition(async () => {
      try {
        const result = await createWebsiteFromTemplate(businessId, { templateId: card.id, whatsappNumber: needsWhatsapp ? whatsapp : undefined });
        if (!result.ok) throw new Error(result.error);
        router.push(`/dashboard/businesses/${businessId}/website/${result.id}`);
      } catch (err) {
        setBusy(null);
        setBig(null);
        setError(err instanceof Error ? err.message : "No se pudo publicar la página");
      }
    });
  }

  function createBlank() {
    if (busy || blankBusy) return;
    if (whatsappMissing) {
      setError("Escribe tu WhatsApp para que los botones de la página te lleven a él.");
      document.getElementById("template-whatsapp")?.focus();
      document.getElementById("template-whatsapp")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    setBlankBusy(true);
    startTransition(async () => {
      try {
        const result = await createBlankWebsite(businessId, { whatsappNumber: needsWhatsapp ? whatsapp : undefined });
        if (!result.ok) throw new Error(result.error);
        router.push(`/dashboard/businesses/${businessId}/website/${result.id}`);
      } catch (err) {
        setBlankBusy(false);
        setError(err instanceof Error ? err.message : "No se pudo crear la página");
      }
    });
  }

  if (blankBusy) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-3xl text-accent-ink">▢</span>
        <div>
          <h2 className="text-xl font-bold">Creando tu página en blanco</h2>
          <p className="mt-1 text-sm text-ink-muted">Un momento: la abrimos para que agregues bloques o pegues tu código.</p>
        </div>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-3xl text-accent-ink">{busy.emoji}</span>
        <div>
          <h2 className="text-xl font-bold">{busy.nicheId === "embudos" ? "Creando tu embudo" : "Publicando tu página"}</h2>
          <p className="mt-1 text-sm text-ink-muted">{busy.nicheId === "embudos" ? "Un momento: queda como borrador para que agregues tu video, fecha o testimonios y luego lo publiques." : "Un momento, ya casi: la abrimos para que la edites cuando quieras."}</p>
        </div>
      </div>
    );
  }

  const sidebarItem = (active: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-accent/15 font-semibold text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink"}`;
  const bigIndex = big ? shown.findIndex((c) => c.id === big.id) : -1;

  return (
    <div className="space-y-4">
      {hasDraft && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span>Tienes una conversación con la IA en curso.</span>
          <button type="button" onClick={onChooseAI} className="font-semibold text-accent hover:underline">
            Continuar →
          </button>
        </div>
      )}

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

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Niches */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="relative">
            <label htmlFor="template-search" className="sr-only">
              Buscar plantillas
            </label>
            <input
              id="template-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Buscar: contadores, citas, formulario…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-ink outline-none focus:border-accent md:text-sm"
            />
          </div>

          {/* Phones: dropdowns. Wider screens: the list. */}
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <select
              aria-label="Nicho"
              value={niche}
              onChange={(e) => {
                setNiche(e.target.value);
                setLimit(PAGE);
              }}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-ink outline-none focus:border-accent"
            >
              <option value="all">Todos ({cards.length})</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.emoji} {n.short}
                </option>
              ))}
            </select>
            <select aria-label="Estilo de color" value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-base text-ink outline-none focus:border-accent">
              <option value="all">Cualquier fondo</option>
              <option value="light">Fondo claro</option>
              <option value="dark">Fondo oscuro</option>
            </select>
          </div>

          <nav aria-label="Nichos" className="hidden space-y-0.5 lg:block">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">Nichos</p>
            <button
              type="button"
              onClick={() => {
                setNiche("all");
                setLimit(PAGE);
              }}
              aria-current={niche === "all"}
              className={sidebarItem(niche === "all")}
            >
              <span>Todos</span>
              <span className="text-xs text-ink-faint">{cards.length}</span>
            </button>
            {niches.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setNiche(n.id);
                  setLimit(PAGE);
                }}
                aria-current={niche === n.id}
                className={sidebarItem(niche === n.id)}
              >
                <span className="min-w-0 truncate">
                  <span aria-hidden="true">{n.emoji} </span>
                  {n.short}
                </span>
                <span className="text-xs text-ink-faint">{n.count}</span>
              </button>
            ))}
          </nav>

          <div className="hidden space-y-1.5 lg:block">
            <p className="px-3 text-xs font-bold uppercase tracking-wide text-ink-faint">Color de fondo</p>
            <div className="fl-seg flex" role="radiogroup" aria-label="Color de fondo">
              {(
                [
                  ["all", "Todos"],
                  ["light", "Claro"],
                  ["dark", "Oscuro"],
                ] as const
              ).map(([key, text]) => (
                <button key={key} type="button" role="radio" aria-checked={tone === key} onClick={() => setTone(key)} className="fl-seg-item flex-1 px-2 py-1.5 text-xs">
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden rounded-xl border border-dashed border-border p-3 lg:block">
            <p className="text-sm font-semibold text-ink">¿No ves tu nicho?</p>
            <p className="mt-0.5 text-xs text-ink-muted">La IA arma una página a tu medida, con tus productos y tus fotos.</p>
            <button type="button" onClick={onChooseAI} className="mt-2 w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold hover:border-accent">
              ✦ Crear con IA
            </button>
          </div>
        </aside>

        {/* Templates */}
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-ink">{niche === "all" ? "Todas las plantillas" : niches.find((n) => n.id === niche)?.name}</h2>
              <p className="text-xs text-ink-muted">
                {shown.length} {shown.length === 1 ? "plantilla" : "plantillas"} · cada una con una estructura distinta pensada para que te escriban.
              </p>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="fl-card p-8 text-center">
              <p className="text-sm font-semibold text-ink">No encontramos plantillas con eso</p>
              <p className="mt-1 text-xs text-ink-muted">Prueba con otra palabra, o pídele a la IA que arme la tuya.</p>
              <button type="button" onClick={onChooseAI} className="mt-3 rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold hover:border-accent">
                ✦ Crear con IA
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className="fl-card flex flex-col overflow-hidden border-dashed">
                <button type="button" onClick={createBlank} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-surface-2/50 text-ink-muted transition hover:text-ink max-sm:hidden" aria-label="Empezar con una página en blanco">
                  <span aria-hidden="true" className="font-mono text-4xl">{"</>"}</span>
                  <span className="text-xs">Sin nada: tú pones los bloques</span>
                </button>
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <p className="text-sm font-bold text-ink"><span aria-hidden="true" className="mr-1.5 font-mono sm:hidden">{"</>"}</span>Página en blanco</p>
                  <p className="line-clamp-2 text-xs text-ink-muted">Arrastra bloques o pega tu propio código HTML, como en Elementor.</p>
                  <button type="button" onClick={createBlank} className="mt-auto rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                    Empezar en blanco
                  </button>
                </div>
              </article>
              <article className="fl-card flex flex-col overflow-hidden border-dashed">
                <button type="button" onClick={() => setHtmlOpen(true)} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-surface-2/50 text-ink-muted transition hover:text-ink max-sm:hidden" aria-label="Subir mi propio HTML">
                  <span aria-hidden="true" className="text-4xl">⬆</span>
                  <span className="text-xs">Tu archivo .html o tu código</span>
                </button>
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <p className="text-sm font-bold text-ink"><span aria-hidden="true" className="mr-1.5 sm:hidden">⬆</span>Subir mi HTML</p>
                  <p className="line-clamp-2 text-xs text-ink-muted">Elige un archivo .html desde tu celular o computador, o pega tu código: queda como una página tuya.</p>
                  <button type="button" onClick={() => setHtmlOpen(true)} className="mt-auto rounded-lg border border-border-strong px-3 py-2 text-sm font-bold text-ink hover:border-accent">
                    Subir mi HTML
                  </button>
                </div>
              </article>
              {visible.map((card) => (
                <article key={card.id} className="fl-card flex flex-col overflow-hidden">
                  <button type="button" onClick={() => setBig(card)} className="block overflow-hidden text-left" aria-label={`Ver página: ${card.nicheName}, ${label(card)}`}>
                    <TemplateThumb card={card} />
                  </button>
                  <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                    <p className="text-sm font-bold text-ink">{label(card)}</p>
                    <p className="text-xs text-ink-faint">
                      <span aria-hidden="true">{card.emoji} </span>
                      {card.nicheName}
                    </p>
                    <p className="line-clamp-2 text-xs text-ink-muted">{card.strategy}</p>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-2.5">
                      <button type="button" onClick={() => setBig(card)} className="rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold hover:border-accent">
                        Ver página
                      </button>
                      <button type="button" onClick={() => publish(card)} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                        {actionLabel(card)}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {shown.length > visible.length && (
            <div className="pt-2 text-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold hover:border-accent">
                Ver más plantillas ({shown.length - visible.length})
              </button>
            </div>
          )}
        </section>
      </div>

      {htmlOpen && <HtmlUploadDialog businessId={businessId} needsWhatsapp={needsWhatsapp} onClose={() => setHtmlOpen(false)} />}
      {big && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label={`Vista previa: ${big.nicheName}, ${label(big)}`}>
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 pb-3">
            <div className="inline-flex rounded-lg border border-white/20 bg-black/40 p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${device === d ? "bg-white text-black" : "text-white/80"}`}>
                  {d === "desktop" ? "Computador" : "Celular"}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm font-semibold text-white">
              <button type="button" aria-label="Plantilla anterior" disabled={bigIndex <= 0} onClick={() => setBig(shown[bigIndex - 1])} className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-30">
                ‹
              </button>
              <span className="min-w-0 truncate">
                {big.nicheName} · {label(big)}
              </span>
              <button type="button" aria-label="Plantilla siguiente" disabled={bigIndex < 0 || bigIndex >= shown.length - 1} onClick={() => setBig(shown[bigIndex + 1])} className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-30">
                ›
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setBig(null)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">
                Cerrar
              </button>
              <button type="button" onClick={() => publish(big)} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                {actionLabel(big)}
              </button>
            </div>
          </div>
          <div className={`mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-white ${device === "mobile" ? "max-w-[390px]" : "max-w-6xl"}`}>
            <DevicePreviewFrame key={big.id} src={previewSrc(big.id)} device={device} />
          </div>
        </div>
      )}
    </div>
  );
}
