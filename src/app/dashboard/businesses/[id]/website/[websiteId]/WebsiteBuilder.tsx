"use client";

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
import { StyleThumb } from "@/components/StyleThumb";

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
}: {
  businessId: string;
  websiteId: string;
  name: string;
  slug: string;
  publicUrl: string;
  initialContent: WebsiteContentV2;
  stats: { views: number; clicks: number; leads: number };
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [tab, setTab] = useState<Tab>("chat");
  const [device, setDevice] = useState<Device>("desktop");
  const [previewVersion, setPreviewVersion] = useState(0);
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
        <div className="mx-auto hidden items-center gap-1 rounded-lg border border-border bg-background p-0.5 md:flex" role="radiogroup" aria-label="Vista">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${device === d ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"}`}
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
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Estilo</p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={!!busy}
                      onClick={() => runDesign("Cambiando estilo…", { style: k as StyleKey })}
                      className={`overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${content.style === k ? "border-accent" : "border-border hover:border-border-strong"}`}
                    >
                      <StyleThumb style={k as StyleKey} className="h-20" />
                      <p className="truncate px-2 py-1.5 text-[12px] font-semibold">{STYLE_INFO[k as StyleKey].label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-ink-faint">Cada estilo cambia formas, colores y tipografías. Luego puedes ajustar los colores abajo o pedirle al Chat IA que adapte los textos.</p>
              </div>
              <ThemeEditor content={content} disabled={!!busy} onSave={(theme) => runDesign("Guardando colores…", { theme })} />
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
            <iframe key={previewVersion} src={`/sitio/${slug}?preview=1&v=${previewVersion}`} title="Vista previa de la página" className="h-full w-full border-0" />
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

function ThemeEditor({
  content,
  disabled,
  onSave,
}: {
  content: WebsiteContentV2;
  disabled: boolean;
  onSave: (theme: Partial<WebsiteContentV2["theme"]>) => void;
}) {
  const [theme, setTheme] = useState(content.theme);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect AI/style changes
    setTheme(content.theme);
  }, [content.theme]);
  const changed = JSON.stringify(theme) !== JSON.stringify(content.theme);
  const colors: [keyof WebsiteContentV2["theme"], string][] = [
    ["primaryColor", "Acento (botones)"],
    ["backgroundColor", "Fondo"],
    ["surfaceColor", "Tarjetas y franjas"],
    ["textColor", "Texto"],
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Colores y tipografía</p>
      <div className="grid grid-cols-2 gap-2">
        {colors.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(theme[key]) ? theme[key] : "#000000"}
              onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
              className="h-7 w-7 flex-none cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="min-w-0 text-[12px] leading-tight">{label}</span>
          </label>
        ))}
      </div>
      {(["headingFont", "bodyFont"] as const).map((key) => (
        <label key={key} className="block space-y-1">
          <span className="text-[12px] text-ink-muted">{key === "headingFont" ? "Fuente de títulos" : "Fuente del texto"}</span>
          <select
            value={theme[key]}
            onChange={(e) => setTheme({ ...theme, [key]: e.target.value as (typeof FONT_OPTIONS)[number] })}
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      ))}
      {changed && (
        <button type="button" disabled={disabled} onClick={() => onSave(theme)} className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
          Aplicar colores y fuentes
        </button>
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
