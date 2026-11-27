"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createBlankWebsite, createWebsiteFromTemplate } from "@/lib/actions";
import type { TemplateCard } from "@/lib/websiteNicheTemplates";
import { DevicePreviewFrame } from "@/components/DevicePreviewFrame";
import { NicheIcon } from "./nicheIcons";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";
import { HtmlUploadDialog } from "./HtmlUploadDialog";
import { UploadIcon } from "./[websiteId]/builderIcons";

const PAGE = 6;
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
}: {
  businessId: string;
  cards: TemplateCard[];
  needsWhatsapp: boolean;
}) {
  const router = useRouter();
  const [niche, setNiche] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<Tone>("all");
  const [page, setPage] = useState(0);
  const [big, setBig] = useState<TemplateCard | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState<TemplateCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [blankBusy, setBlankBusy] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [, startTransition] = useTransition();

  const niches = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; short: string; count: number }>();
    for (const c of cards) {
      const n = seen.get(c.nicheId) ?? { id: c.nicheId, name: c.nicheName, short: c.nicheShort, count: 0 };
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

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * PAGE, current * PAGE + PAGE);
  const digits = whatsapp.replace(/\D/g, "");
  const whatsappMissing = needsWhatsapp && (digits.length < 8 || digits.length > 15);
  const previewSrc = (id: string) => `/dashboard/businesses/${businessId}/website/muestra?template=${id}`;
  const label = (c: TemplateCard) => `${c.number} · ${c.name}`;
  // Funnels are created as drafts (they need the owner's own video, date or testimonials first).
  const actionLabel = () => "Editar";

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
        setError(err instanceof Error ? err.message : "No se pudo crear la página");
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
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-3xl text-accent-ink"><NicheIcon id={busy.nicheId} className="h-8 w-8" /></span>
        <div>
          <h2 className="text-xl font-bold">Preparando tu página</h2>
          <p className="mt-1 text-sm text-ink-muted">Un momento: la abrimos para que la edites y la publiques cuando quieras.</p>
        </div>
      </div>
    );
  }

  const bigIndex = big ? shown.findIndex((c) => c.id === big.id) : -1;

  return (
    <div className="space-y-4">
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

      {/* Toolbar: niches as tabs, search, background and the two ways to bring your own page. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label="Nichos" className="-mx-1 flex min-w-0 basis-full gap-2 overflow-x-auto px-1 py-2">
          {[{ id: "all", label: "Todos" }, ...niches.map((n) => ({ id: n.id, label: n.short }))].map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={niche === n.id}
              onClick={() => {
                setNiche(n.id);
                setPage(0);
              }}
              className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${niche === n.id ? "border-accent bg-accent font-bold text-accent-ink shadow-sm" : "border-border-strong font-medium text-ink hover:border-accent hover:bg-accent/10"}`}
            >
              <NicheIcon id={n.id} className="mr-1.5 inline-block h-[17px] w-[17px] -translate-y-px" />
              {n.label}
            </button>
          ))}
        </nav>
        <label htmlFor="template-search" className="sr-only">
          Buscar plantillas
        </label>
        <input
          id="template-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar…"
          className="mr-auto h-9 w-52 rounded-lg border border-border bg-background px-3 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="fl-seg flex" role="radiogroup" aria-label="Color de fondo">
          {([["all", "Todos"], ["light", "Claro"], ["dark", "Oscuro"]] as const).map(([key, text]) => (
            <button key={key} type="button" role="radio" aria-checked={tone === key} onClick={() => { setTone(key); setPage(0); }} className="fl-seg-item px-3 py-1.5 text-xs">
              {text}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={createBlank} className="h-9 rounded-lg border border-border-strong px-3 text-[13px] font-semibold text-ink transition hover:border-accent">
            <span aria-hidden="true" className="mr-1 font-mono">{"</>"}</span>En blanco
          </button>
          <button type="button" onClick={() => setHtmlOpen(true)} className="h-9 rounded-lg border border-border-strong px-3 text-[13px] font-semibold text-ink transition hover:border-accent">
            <UploadIcon className="mr-1.5 inline h-4 w-4 -translate-y-px" />Subir HTML
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="fl-card p-8 text-center">
          <p className="text-sm font-semibold text-ink">No encontramos plantillas con eso</p>
          <p className="mt-1 text-xs text-ink-muted">Prueba con otra palabra o cambia el filtro.</p>
        </div>
      ) : (
        <ul className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((card) => (
            <li key={card.id} className="group min-w-0">
              <div className="relative overflow-hidden rounded-xl border border-border bg-surface transition group-hover:border-accent/70 group-focus-within:border-accent/70">
                <ScaledPagePreview src={previewSrc(card.id)} aspect={0.72} title={`Plantilla: ${card.nicheName}, ${label(card)}`} />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => setBig(card)} aria-label={`Ver página: ${card.nicheName}, ${label(card)}`} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                    Ver
                  </button>
                  <button type="button" onClick={() => publish(card)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover">
                    {actionLabel()}
                  </button>
                </div>
              </div>
              <p title={card.strategy} className="mt-2 flex items-baseline gap-2 px-0.5">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{label(card)}</span>
                {niche === "all" && (
                  <span className="flex-none truncate text-xs text-ink-faint">
                    {card.nicheShort}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas de plantillas" className="flex items-center justify-center gap-3 pt-1">
          <button type="button" disabled={current === 0} aria-label="Anterior" onClick={() => { setPage(current - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-9 w-9 rounded-lg border border-border-strong text-lg hover:border-accent disabled:opacity-35">
            ‹
          </button>
          <p className="text-sm tabular-nums text-ink-muted">
            <strong className="text-ink">{current + 1}</strong> / {pages}
          </p>
          <button type="button" disabled={current >= pages - 1} aria-label="Siguiente" onClick={() => { setPage(current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-9 w-9 rounded-lg bg-accent text-lg font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-35">
            ›
          </button>
        </nav>
      )}

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
                {actionLabel()}
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
