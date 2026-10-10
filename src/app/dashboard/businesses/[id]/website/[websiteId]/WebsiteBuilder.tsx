"use client";

import { TrackingSettings } from "./TrackingSettings";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyWebsitePromptV2, regenerateWebsitePageV2, updateWebsiteDesignV2 } from "@/lib/actions";
import {
  PAGE_TYPE_LABELS,
  SECTION_LABELS,
  STYLE_INFO,
  STYLE_KEYS,
  type StyleKey,
  type WebsiteContentV2,
} from "@/lib/websiteContentV2";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";
import { ColorCodeInput } from "@/components/ColorCodeInput";
import { STYLE_THEME } from "@/lib/websiteStylePreview";

type Tab = "chat" | "diseno" | "secciones" | "ajustes";
type Device = "desktop" | "tablet" | "mobile";
type ChatEntry = { role: "user" | "assistant"; text: string; error?: boolean };

const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

const SUGGESTIONS = [
  "Haz el titular más corto y directo",
  "Agrega una sección de preguntas frecuentes",
  "Cambia a un estilo más elegante",
  "Usa colores más cálidos",
  "Pon el botón principal más llamativo",
  "Agrega una franja con una promoción",
];

function sectionTitle(s: WebsiteContentV2["sections"][number]): string {
  if ("heading" in s && typeof s.heading === "string") return s.heading;
  if (s.type === "trustBar") return s.items.map((i) => i.title).join(" · ");
  if (s.type === "stats") return s.items.map((i) => i.value).join(" · ");
  return "";
}

/**
 * Full-screen builder for v2 pages: live preview in the middle (desktop /
 * tablet / phone), and on the side the AI chat for any change in plain
 * words, the style gallery, and the section list (show/hide, reorder).
 */
export function WebsiteBuilder({
  businessId,
  websiteId,
  name,
  slug,
  publicUrl,
  initialContent,
  stats,
  tracking,
  initialTab = "chat",
}: {
  businessId: string;
  websiteId: string;
  name: string;
  slug: string;
  publicUrl: string;
  initialContent: WebsiteContentV2;
  stats: { views: number; clicks: number; leads: number };
  tracking: { metaPixelId: string | null; googleTagId: string | null };
  // ?tab=ajustes from the pages list's "Píxel" shortcut.
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewVersion, setPreviewVersion] = useState(0);
  // Unsaved colors/fonts from the Diseño tab, shown live in the preview.
  const [draftTheme, setDraftTheme] = useState<WebsiteContentV2["theme"] | null>(null);
  const [previewTheme, setPreviewTheme] = useState<WebsiteContentV2["theme"] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setPreviewTheme(draftTheme), 350);
    return () => clearTimeout(id);
  }, [draftTheme]);
  const [chat, setChat] = useState<ChatEntry[]>([
    { role: "assistant", text: "Pídeme cualquier cambio como se lo pedirías a tu diseñador: textos, colores, secciones, estilo. Lo aplico y lo ves al instante en la vista previa." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"panel" | "preview">("panel");
  const [isPending, startTransition] = useTransition();
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, busy]);

  const refreshPreview = () => setPreviewVersion((v) => v + 1);

  function runDesign(label: string, patch: Parameters<typeof updateWebsiteDesignV2>[2]) {
    setBusy(label);
    startTransition(async () => {
      try {
        const next = await updateWebsiteDesignV2(businessId, websiteId, patch);
        setContent(next);
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  function sendChat(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text: t }]);
    setBusy("Aplicando tu cambio…");
    startTransition(async () => {
      try {
        const result = await applyWebsitePromptV2(businessId, websiteId, t);
        if (!result.ok) throw new Error(result.error);
        setContent(result.content);
        refreshPreview();
        setChat((c) => [...c, { role: "assistant", text: "Listo, ya está aplicado. Revísalo en la vista previa y dime si quieres ajustar algo más." }]);
        setMobilePanel("preview");
      } catch (err) {
        setChat((c) => [...c, { role: "assistant", text: err instanceof Error ? err.message : "No pude aplicar el cambio", error: true }]);
      } finally {
        setBusy(null);
      }
    });
  }

  function regenerate() {
    if (!confirm("¿Rehacer toda la página con IA? Se reemplazan textos, estilo y secciones actuales.")) return;
    setBusy("Rehaciendo la página con IA…");
    startTransition(async () => {
      try {
        const result = await regenerateWebsitePageV2(businessId, websiteId);
        if (!result.ok) {
          setChat((c) => [...c, { role: "assistant", text: result.error, error: true }]);
          setTab("chat");
          return;
        }
        router.refresh();
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the link is still visible to copy by hand.
    }
  }

  // Server re-renders hand us fresh content after regenerate.
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const hidden = new Set(content.hidden);
  const TABS: { key: Tab; label: string }[] = [
    { key: "chat", label: "✦ Chat IA" },
    { key: "diseno", label: "Diseño" },
    { key: "secciones", label: "Secciones" },
    { key: "ajustes", label: "Ajustes" },
  ];

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col md:-m-6">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 md:px-4">
        <Link href={`/dashboard/businesses/${businessId}/website`} className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink">
          ← Sitios
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-[11px] text-ink-faint">
            {PAGE_TYPE_LABELS[content.pageType]} · {STYLE_INFO[content.style].label}
          </p>
        </div>
        <div className="fl-seg mx-auto hidden md:inline-flex" role="radiogroup" aria-label="Vista">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              onClick={() => setDevice(d)}
              className="fl-seg-item px-3 py-1.5 text-xs"
            >
              {d === "desktop" ? "🖥 Escritorio" : d === "tablet" ? "Tablet" : "📱 Celular"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Publicada
          </span>
          <button type="button" onClick={copyLink} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-accent">
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover">
            Ver página ↗
          </a>
        </div>
      </header>

      {/* Phone: switch between panel and preview */}
      <div className="flex gap-1 border-b border-border bg-surface p-1.5 md:hidden">
        {(["panel", "preview"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${mobilePanel === p ? "bg-accent text-accent-ink" : "text-ink-muted"}`}
          >
            {p === "panel" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Side panel */}
        <aside className={`${mobilePanel === "panel" ? "flex" : "hidden"} w-full flex-col border-r border-border bg-surface md:flex md:w-[23rem] md:flex-none`}>
          <nav className="flex gap-1 border-b border-border p-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${tab === t.key ? "bg-background text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "chat" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {chat.map((m, i) =>
                  m.role === "user" ? (
                    <p key={i} className="ml-8 rounded-2xl rounded-tr-md bg-accent/15 px-3 py-2 text-sm">{m.text}</p>
                  ) : (
                    <div key={i} className="flex gap-2">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs text-accent-ink">✦</span>
                      <p className={`pt-1 text-sm ${m.error ? "text-error" : "text-ink"}`}>{m.text}</p>
                    </div>
                  ),
                )}
                {busy && (
                  <p className="flex items-center gap-2 pl-9 text-xs text-ink-muted">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent" /> {busy}
                  </p>
                )}
              </div>
              <div className="space-y-2 border-t border-border p-3">
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button key={s} type="button" disabled={!!busy} onClick={() => sendChat(s)} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-ink-muted hover:border-accent hover:text-ink disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendChat(input);
                  }}
                  className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-accent/60"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat(input);
                      }
                    }}
                    rows={2}
                    placeholder="Ej: cambia el titular por algo sobre envíos gratis y pon el fondo más claro"
                    className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-ink-faint md:text-sm"
                  />
                  <button type="submit" disabled={!!busy || !input.trim()} className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-50">
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === "diseno" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3">
              <ThemeEditor
                content={content}
                disabled={!!busy}
                onDraftChange={setDraftTheme}
                onSave={(theme) => {
                  setDraftTheme(null);
                  runDesign("Guardando colores…", { theme });
                }}
              />
              <div className="space-y-2 border-t border-border pt-5">
                <p className="text-sm font-semibold text-ink">Estilo de la página</p>
                <p className="text-[12px] text-ink-muted">Cambia formas, colores y tipografías de una vez.</p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={!!busy}
                      onClick={() => runDesign("Cambiando estilo…", { style: k as StyleKey })}
                      className={`overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${content.style === k ? "border-accent" : "border-border hover:border-border-strong"}`}
                    >
                      <ScaledPagePreview src={`/dashboard/businesses/${businessId}/website/muestra?style=${k}&type=${content.pageType}`} aspect={0.62} title={`Estilo ${STYLE_INFO[k as StyleKey].label}`} />
                      <p className="truncate px-2 py-1.5 text-[12px] font-semibold">{STYLE_INFO[k as StyleKey].label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "secciones" && (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              <p className="text-[12px] text-ink-faint">Oculta o reordena secciones. Para agregar una nueva, pídesela al Chat IA (ej. “agrega una comparación con la competencia”).</p>
              {content.sections.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg border border-border bg-background p-2 ${hidden.has(i) ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{SECTION_LABELS[s.type]}</p>
                    <p className="truncate text-[12px] text-ink-muted">{sectionTitle(s) || "—"}</p>
                  </div>
                  {i > 0 && (
                    <>
                      <button type="button" disabled={!!busy || i <= 1} onClick={() => runDesign("Moviendo…", { move: { from: i, to: i - 1 } })} aria-label="Subir" className="h-7 w-7 rounded-md border border-border text-xs disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" disabled={!!busy || i >= content.sections.length - 1} onClick={() => runDesign("Moviendo…", { move: { from: i, to: i + 1 } })} aria-label="Bajar" className="h-7 w-7 rounded-md border border-border text-xs disabled:opacity-30">
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() =>
                          runDesign("Actualizando…", {
                            hidden: hidden.has(i) ? content.hidden.filter((h) => h !== i) : [...content.hidden, i],
                          })
                        }
                        aria-label={hidden.has(i) ? "Mostrar sección" : "Ocultar sección"}
                        className="h-7 rounded-md border border-border px-2 text-[11px] font-semibold"
                      >
                        {hidden.has(i) ? "Mostrar" : "Ocultar"}
                      </button>
                    </>
                  )}
                  {i === 0 && <span className="text-[11px] text-ink-faint">Fija</span>}
                </div>
              ))}
            </div>
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
              <CtaUrlEditor value={content.heroCtaUrl} disabled={!!busy} onSave={(url) => runDesign("Guardando…", { heroCtaUrl: url })} />
              <TrackingSettings businessId={businessId} websiteId={websiteId} metaPixelId={tracking.metaPixelId} googleTagId={tracking.googleTagId} />
              <Link href={`/dashboard/businesses/${businessId}/productos`} className="block rounded-lg border border-border bg-background p-3 text-sm hover:border-accent">
                🛍️ <strong>Productos</strong>
                <span className="block text-xs text-ink-muted">Agrega o edita los productos que aparecen en tu tienda.</span>
              </Link>
              <button type="button" onClick={regenerate} disabled={!!busy} className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60">
                Rehacer toda la página con IA
              </button>
            </div>
          )}
        </aside>

        {/* Live preview */}
        <main className={`${mobilePanel === "preview" ? "flex" : "hidden"} min-w-0 flex-1 justify-center overflow-auto bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_10px,var(--background)_10px,var(--background)_20px)] p-0 md:flex md:p-4`}>
          <div
            className={`relative h-full overflow-hidden bg-white transition-[width] duration-300 md:rounded-xl md:border md:border-border md:shadow-2xl ${isPending ? "opacity-80" : ""}`}
            style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
          >
            <iframe
              key={`${previewVersion}-${previewTheme ? themeQuery(previewTheme) : ""}`}
              src={`/sitio/${slug}?preview=1&v=${previewVersion}${previewTheme ? `&${themeQuery(previewTheme)}` : ""}`}
              title="Vista previa de la página"
              className="h-full w-full border-0"
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                <span className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-lg">✦ {busy}</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function themeQuery(theme: WebsiteContentV2["theme"]): string {
  return new URLSearchParams({
    pc: theme.primaryColor,
    bg: theme.backgroundColor,
    sc: theme.surfaceColor,
    tc: theme.textColor,
    hf: theme.headingFont,
    bf: theme.bodyFont,
  }).toString();
}

const COLOR_FIELDS: { key: "primaryColor" | "backgroundColor" | "surfaceColor" | "textColor"; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Color principal", hint: "Botones, enlaces y palabras destacadas" },
  { key: "backgroundColor", label: "Fondo", hint: "El color de fondo de toda la página" },
  { key: "surfaceColor", label: "Tarjetas y franjas", hint: "Bloques y secciones alternas" },
  { key: "textColor", label: "Texto", hint: "Títulos y párrafos" },
];

const PALETTE_STYLES = ["corporativo", "clinico", "calido", "producto", "pop", "tech", "lujo", "gourmet"] as const;

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M13.6 3.6a2 2 0 0 1 2.8 2.8l-8.7 8.7-3.6.8.8-3.6 8.7-8.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeEditor({
  content,
  disabled,
  onSave,
  onDraftChange,
}: {
  content: WebsiteContentV2;
  disabled: boolean;
  onSave: (theme: Partial<WebsiteContentV2["theme"]>) => void;
  onDraftChange: (theme: WebsiteContentV2["theme"] | null) => void;
}) {
  const [theme, setTheme] = useState(content.theme);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect AI/style changes
    setTheme(content.theme);
    onDraftChange(null);
  }, [content.theme, onDraftChange]);
  const changed = JSON.stringify(theme) !== JSON.stringify(content.theme);

  function update(next: WebsiteContentV2["theme"]) {
    setTheme(next);
    onDraftChange(JSON.stringify(next) === JSON.stringify(content.theme) ? null : next);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <PencilIcon className="h-4 w-4 text-accent" /> Colores de tu página
        </p>
        <p className="text-[12px] text-ink-muted">Toca el color o pega su código (#F3F3EF o rgb). Verás el cambio en la página al instante.</p>
      </div>

      <div className="space-y-2">
        {COLOR_FIELDS.map(({ key, label, hint }) => {
          const value = /^#[0-9a-fA-F]{6}$/.test(theme[key]) ? theme[key] : "#000000";
          return (
            <div key={key} className="group flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 transition hover:border-accent focus-within:border-accent">
              <label className="relative h-11 w-11 flex-none cursor-pointer" title={`Cambiar ${label.toLowerCase()}`}>
                <span className="block h-full w-full rounded-lg border border-black/10 shadow-inner" style={{ background: value }} />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-ink shadow">
                  <PencilIcon className="h-3 w-3" />
                </span>
                <input
                  type="color"
                  value={value}
                  disabled={disabled}
                  onChange={(e) => update({ ...theme, [key]: e.target.value })}
                  aria-label={`Cambiar ${label.toLowerCase()}`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-ink">{label}</p>
                <p className="truncate text-[12px] text-ink-muted">{hint}</p>
              </div>
              <ColorCodeInput
                value={theme[key]}
                disabled={disabled}
                label={label.toLowerCase()}
                onChange={(hex) => update({ ...theme, [key]: hex })}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-ink">Combinaciones listas</p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTE_STYLES.map((k) => {
            const p = STYLE_THEME[k];
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                title={STYLE_INFO[k].label}
                onClick={() =>
                  update({ ...theme, primaryColor: p.primaryColor, backgroundColor: p.backgroundColor, surfaceColor: p.surfaceColor, textColor: p.textColor })
                }
                className="overflow-hidden rounded-lg border border-border transition hover:border-accent disabled:opacity-50"
              >
                <span className="flex h-9" style={{ background: p.backgroundColor }}>
                  <span className="m-auto flex gap-1">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.primaryColor }} />
                    <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: p.surfaceColor }} />
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.textColor }} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-ink">Tipografía</p>
        {(["headingFont", "bodyFont"] as const).map((key) => (
          <label key={key} className="block space-y-1">
            <span className="text-[12px] text-ink-muted">{key === "headingFont" ? "Títulos" : "Textos"}</span>
            <select
              value={theme[key]}
              disabled={disabled}
              onChange={(e) => update({ ...theme, [key]: e.target.value as (typeof FONT_OPTIONS)[number] })}
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
              style={{ fontFamily: `"${theme[key]}", system-ui, sans-serif` }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {changed && (
        <div className="sticky bottom-0 -mx-3 flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.3)]">
          <p className="min-w-0 flex-1 text-[12px] text-ink-muted">Cambios sin guardar</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => update(content.theme)}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={disabled || COLOR_FIELDS.some(({ key }) => !/^#[0-9a-fA-F]{6}$/.test(theme[key]))}
            onClick={() => onSave(theme)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink disabled:opacity-60"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}

function CtaUrlEditor({ value, disabled, onSave }: { value: string | null; disabled: boolean; onSave: (url: string | null) => void }) {
  const [url, setUrl] = useState(value ?? "");
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Botón principal</p>
      <p className="text-[12px] text-ink-muted">Vacío = abre tu WhatsApp. O pon un link (agenda, checkout).</p>
      <div className="flex gap-1.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="button" disabled={disabled || url === (value ?? "")} onClick={() => onSave(url.trim() || null)} className="rounded-md border border-border-strong px-3 text-xs font-semibold disabled:opacity-40">
          Guardar
        </button>
      </div>
    </div>
  );
}
