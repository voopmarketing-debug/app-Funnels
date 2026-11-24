"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { applyWebsitePromptV2, regenerateWebsitePageV2, updateTemplateSiteTextV3 } from "@/lib/actions";
import { attachPreviewEditor, type EditorHandlers } from "./previewEditor";
import { fromPanelUrl } from "@/lib/panelBackLink";
import { TrackingSettings } from "./TrackingSettings";
import { RegenerateBox } from "./RegenerateBox";
import { PublishControl } from "./PublishControl";

type Device = "desktop" | "mobile";
type ChatEntry = { role: "user" | "assistant"; text: string };

const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", mobile: "390px" };

const INTRO_CHAT: ChatEntry = {
  role: "assistant",
  text: "Pídeme cualquier cambio como se lo pedirías a tu diseñador: titulares, ofertas, textos, colores. Los productos, fotos y precios se cambian en Productos y se actualizan solos aquí.",
};

const IDEAS = [
  "Cambia el titular por uno más corto",
  "Agrega una oferta del mes con descuento",
  "Quita la cuenta regresiva",
  "Cambia el color de acento a verde",
];

/**
 * The builder for Showroom and Scroll Story pages: the page itself is a fixed, hand-designed
 * template (layout, motion, 360° viewer, quoter, fan), so what the owner changes here is the
 * content: texts and data by chat, products and photos in Productos.
 */
export function TemplateBuilder({
  businessId,
  websiteId,
  name,
  slug,
  publicUrl,
  templateLabel,
  stats,
  tracking,
  savedBrief = "",
  published = true,
}: {
  businessId: string;
  websiteId: string;
  name: string;
  slug: string;
  publicUrl: string;
  templateLabel: string;
  stats: { views: number; clicks: number; leads: number };
  tracking: { metaPixelId: string | null; googleTagId: string | null };
  savedBrief?: string;
  published?: boolean;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<"chat" | "ajustes">("chat");
  const [chat, setChat] = useState<ChatEntry[]>([INTRO_CHAT]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"panel" | "preview">("preview");
  const [phoneMenu, setPhoneMenu] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a per-device preference once
      setHintDismissed(localStorage.getItem("fl-template-edit-hint") === "1");
    } catch {
      setHintDismissed(false);
    }
  }, []);
  const [, startTransition] = useTransition();
  const chatRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toast, setToast] = useState<string | null>(null);

  // Click-to-edit on the preview: only texts can be written on here (the layout is fixed). Everything
  // else a block's toolbar would do does not exist on these pages, so those handlers do nothing.
  const handlers: EditorHandlers = {
    async saveText(path, value) {
      setSaveState("saving");
      const res = await updateTemplateSiteTextV3(businessId, websiteId, path, value);
      if (!res.ok) {
        setSaveState("error");
        return { ok: false, error: res.error };
      }
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2500);
      return { ok: true, refresh: value.trim() === "" };
    },
    pickImage: () => {},
    move: () => {},
    hide: () => {},
    style: () => {},
    dropBlock: () => {},
    code: () => {},
    add: () => {},
    duplicate: () => {},
    remove: () => {},
    select: () => {},
    undo: () => {},
    redo: () => {},
    section: () => null,
    notice: (message) => {
      setToast(message);
      setTimeout(() => setToast(null), 3500);
    },
  };
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  function onPreviewLoad() {
    detachRef.current?.();
    detachRef.current = null;
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) detachRef.current = attachPreviewEditor(doc, () => handlersRef.current);
  }
  useEffect(() => {
    // The first preview can finish loading before this page is ready: attach to it here.
    const doc = iframeRef.current?.contentDocument;
    if (doc && doc.readyState === "complete" && doc.querySelector("[data-edit]") && !doc.querySelector("style[data-fl-editor]")) onPreviewLoad();
    return () => detachRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [chat, busy]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text: t }]);
    setBusy("Aplicando tu cambio…");
    startTransition(async () => {
      const result = await applyWebsitePromptV2(businessId, websiteId, t);
      setBusy(null);
      if (!result.ok) {
        setChat((c) => [...c, { role: "assistant", text: result.error }]);
        return;
      }
      setChat((c) => [...c, { role: "assistant", text: "Listo, ya lo apliqué. Míralo en la vista previa." }]);
      setVersion((v) => v + 1);
      setMobilePanel("preview");
    });
  }

  function regenerate(brief: string) {
    if (busy) return;
    setBusy("Rehaciendo tu página…");
    startTransition(async () => {
      try {
        const result = await regenerateWebsitePageV2(businessId, websiteId, brief);
        if (!result.ok) {
          setChat((c) => [...c, { role: "assistant", text: result.error }]);
          setTab("chat");
          return;
        }
        // A fresh page starts a fresh conversation.
        setChat([INTRO_CHAT, { role: "assistant", text: "Listo, rehice la página con tu prompt, tus productos y tus fotos. Míralo en la vista previa." }]);
        setTab("chat");
        setVersion((v) => v + 1);
        setMobilePanel("preview");
      } catch (err) {
        setChat((c) => [...c, { role: "assistant", text: err instanceof Error && err.message ? err.message : "No pude rehacer la página. Intenta de nuevo en un momento." }]);
        setTab("chat");
      } finally {
        setBusy(null);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copia este link:", publicUrl);
    }
  }

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col md:-m-6">
      {/* Phone top bar: one row. */}
      <header className="flex items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 md:hidden">
        <Link href={`/dashboard/businesses/${businessId}/website`} aria-label="Volver a mis sitios" className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl text-ink-muted active:bg-surface-2">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{name}</p>
          <p aria-live="polite" className={`truncate text-[11px] leading-tight ${saveState === "error" ? "text-error" : "text-ink-faint"}`}>
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : saveState === "error" ? "No se guardó" : "Se guarda solo"}
          </p>
        </div>
        <PublishControl businessId={businessId} websiteId={websiteId} published={published} variant="chip" />
        <button type="button" onClick={() => setPhoneMenu(true)} aria-label="Más opciones" aria-haspopup="dialog" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-xl leading-none">
          ⋯
        </button>
      </header>

      {phoneMenu && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50 md:hidden" onClick={() => setPhoneMenu(false)}>
          <div role="dialog" aria-label="Más opciones" className="w-full space-y-2 rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink-faint">{name}</p>
            <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-3 rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink">
              <span aria-hidden="true">↗</span> Ver mi página
            </a>
            <button type="button" onClick={() => { void copyLink(); setPhoneMenu(false); }} className="flex h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-semibold">
              <span aria-hidden="true">🔗</span> {copied ? "¡Link copiado!" : "Copiar el link"}
            </button>
            <button type="button" onClick={() => setPhoneMenu(false)} className="h-12 w-full rounded-xl text-sm font-semibold text-ink-muted">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Top bar (tablet and desktop) */}
      <header className="hidden flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 md:flex md:px-4">
        <Link href={`/dashboard/businesses/${businessId}/website`} className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink">
          ← Sitios
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-[11px] text-ink-faint">{templateLabel}</p>
        </div>
        <div className="fl-seg mx-auto hidden md:inline-flex" role="radiogroup" aria-label="Vista">
          {(["desktop", "mobile"] as Device[]).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className="fl-seg-item px-3 py-1.5 text-xs">
              {d === "desktop" ? "🖥 Escritorio" : "📱 Celular"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <PublishControl businessId={businessId} websiteId={websiteId} published={published} />
          <button type="button" onClick={copyLink} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-accent">
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
          <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover">
            Ver página
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${mobilePanel === "panel" ? "flex" : "hidden"} min-h-0 w-full flex-col border-r border-border bg-surface md:flex md:w-[22rem] md:flex-none`}>
          <div className="fl-seg m-3 inline-flex" role="radiogroup" aria-label="Pestañas">
            {(["chat", "ajustes"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tab === t} onClick={() => setTab(t)} className="fl-seg-item flex-1 px-3 py-1.5 text-xs">
                {t === "chat" ? "✦ Cambios con IA" : "Ajustes"}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <>
              <div ref={chatRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
                {chat.map((m, i) => (
                  <p key={i} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}>
                    {m.text}
                  </p>
                ))}
                {busy && <p className="max-w-[92%] rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink-muted">✦ {busy}</p>}
                {chat.length < 3 && !busy && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {IDEAS.map((idea) => (
                      <button key={idea} type="button" onClick={() => send(idea)} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-ink-muted hover:border-accent hover:text-ink">
                        {idea}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2 border-t border-border p-3"
              >
                <label htmlFor="template-chat" className="sr-only">
                  Qué quieres cambiar
                </label>
                <textarea
                  id="template-chat"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={2}
                  maxLength={6000}
                  placeholder="Ej.: pon la oferta de noviembre con 10 % de descuento"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
                />
                <button type="submit" disabled={!!busy || !input.trim()} className="self-end rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50">
                  Enviar
                </button>
              </form>
            </>
          )}

          {tab === "ajustes" && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Visitas", stats.views],
                  ["Clics", stats.clicks],
                  ["Registros", stats.leads],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border bg-background p-2.5">
                    <p className="text-[11px] text-ink-muted">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Link público</p>
                <p className="break-all rounded-md border border-border bg-background px-2.5 py-2 text-xs">{publicUrl}</p>
              </div>
              <Link href={`/dashboard/businesses/${businessId}/productos`} className="block rounded-lg border border-border bg-background p-3 text-sm hover:border-accent">
                🛍️ <strong>Productos y fotos</strong>
                <span className="block text-xs text-ink-muted">Cambia productos, precios y fotos (incluidas las de otros ángulos para el giro 360°). Se actualizan solos en la página.</span>
              </Link>
              <TrackingSettings businessId={businessId} websiteId={websiteId} metaPixelId={tracking.metaPixelId} googleTagId={tracking.googleTagId} />
              <RegenerateBox savedBrief={savedBrief} busy={!!busy} onRegenerate={regenerate} />
            </div>
          )}
        </aside>

        <div className={`${mobilePanel === "preview" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}>
        {!hintDismissed && (
          <div className="flex items-center gap-3 border-b border-border bg-accent/10 px-3 py-2 text-[12.5px] leading-snug text-ink">
            <p className="min-w-0 flex-1">
              <strong>✏️ Toca un texto</strong> de la página para escribir sobre él. Los productos, precios y fotos se cambian en <strong>Productos</strong>; lo demás, con el chat de IA.
            </p>
            <button type="button" onClick={() => { setHintDismissed(true); try { localStorage.setItem("fl-template-edit-hint", "1"); } catch { /* shows again next time */ } }} className="flex-none rounded-md border border-border-strong px-2.5 py-1 text-xs font-semibold hover:border-accent">
              Entendido
            </button>
          </div>
        )}
        <main className={`flex relative min-h-0 min-w-0 flex-1 justify-center overflow-auto bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_10px,var(--background)_10px,var(--background)_20px)] p-0 md:flex md:p-4`}>
          <div className="relative h-full overflow-hidden bg-white transition-[width] duration-300 md:rounded-xl md:border md:border-border md:shadow-2xl" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
            <iframe ref={iframeRef} onLoad={onPreviewLoad} key={version} src={`/sitio/${slug}?preview=1&edit=1&v=${version}`} title="Vista previa de tu página, editable: toca un texto para cambiarlo" className="h-full w-full border-0" />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                <span className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-lg">✦ {busy}</span>
              </div>
            )}
          </div>
        </main>
        </div>
      </div>

      {toast && (
        <p role="status" className="pointer-events-none fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-lg md:bottom-6">
          {toast}
        </p>
      )}

      {/* Phone: the two things you do, at thumb reach. */}
      <nav aria-label="Modo" className="flex flex-none gap-2 border-t border-border bg-surface p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
        {(["preview", "panel"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            aria-pressed={mobilePanel === p}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${mobilePanel === p ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted"}`}
          >
            <span aria-hidden="true">{p === "panel" ? "✦" : "✎"}</span>
            {p === "panel" ? "IA y ajustes" : "Mi página"}
          </button>
        ))}
      </nav>
    </div>
  );
}
