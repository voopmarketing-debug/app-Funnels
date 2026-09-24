"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWebsiteContent, updateWebsiteCustomDomain, regenerateWebsitePage, applyWebsitePrompt } from "@/lib/actions";
import { FONT_OPTIONS, type WebsiteContent } from "@/lib/websiteContent";
import { DownloadCsvButton } from "@/components/DownloadCsvButton";

export function WebsiteEditor({
  businessId,
  websiteId,
  content: initialContent,
  customDomain,
  generatedAt,
  publicUrl,
  stats,
  leads,
  otherPages,
}: {
  businessId: string;
  websiteId: string;
  content: WebsiteContent;
  customDomain: string | null;
  generatedAt: Date;
  publicUrl: string;
  stats: { totalViews: number; clicksWhatsapp: number; clicksAgenda: number };
  leads: { id: string; name: string; contact: string; message: string | null; createdAt: Date }[];
  // This business's other pages (landing or agenda) — lets the hero CTA
  // link straight to one of them (typically an agenda page) via a picker
  // instead of the owner having to copy-paste its URL by hand.
  otherPages: { name: string; pageType: string; publicUrl: string }[];
}) {
  const router = useRouter();
  const [content, setContent] = useState<WebsiteContent>(initialContent);
  const [isSaving, startSaving] = useTransition();
  const [isRegenerating, startRegenerating] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isApplyingPrompt, startApplyingPrompt] = useTransition();
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptApplied, setPromptApplied] = useState(false);

  function save() {
    setSaveError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        await updateWebsiteContent(businessId, websiteId, content);
        setSaved(true);
        setPreviewKey((k) => k + 1);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  function regenerate() {
    if (!confirm("Esto reemplaza todo el texto y los colores actuales con una nueva versión generada por IA. ¿Seguir?")) return;
    startRegenerating(async () => {
      await regenerateWebsitePage(businessId, websiteId);
      router.refresh();
    });
  }

  function applyPrompt() {
    if (!promptText.trim()) return;
    setPromptError(null);
    setPromptApplied(false);
    startApplyingPrompt(async () => {
      try {
        const updated = await applyWebsitePrompt(businessId, websiteId, promptText);
        setContent(updated);
        setPromptText("");
        setPromptApplied(true);
        setPreviewKey((k) => k + 1);
        setTimeout(() => setPromptApplied(false), 6000);
      } catch (err) {
        setPromptError(err instanceof Error ? err.message : "No se pudo aplicar el cambio");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <div className="fl-card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-ink">✨ Pide cambios con IA</h2>
          <p className="text-xs text-ink-muted">
            Escribe qué quieres cambiar, como si le hablaras a un diseñador — ej. "pon el botón principal en azul",
            "hazlo sonar más formal", "cambia el título del hero". La IA reescribe textos, colores y fuentes de las
            secciones que ya existen en la página.
          </p>
          <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-ink-muted">
            No agrega bloques nuevos ni animaciones — para que agenden, crea una página de Agenda y apúntale el
            botón ahí.
          </p>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={2}
            placeholder="Ej: cambia el color principal a morado y hazlo más corto"
            disabled={isApplyingPrompt}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                applyPrompt();
              }
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyPrompt}
              disabled={isApplyingPrompt || !promptText.trim()}
              className="rounded-md bg-accent-secondary px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {isApplyingPrompt ? "Aplicando... (puede tardar un minuto)" : "Aplicar cambio"}
            </button>
          </div>
          {promptApplied && (
            <p className="fl-mono rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
              ✓ Cambio aplicado y guardado — ya está en tu página, revisa la vista previa a la derecha
            </p>
          )}
          {promptError && (
            <p className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs font-semibold text-error">
              ✕ {promptError}
            </p>
          )}
        </div>

        <div className="fl-card flex flex-wrap items-center gap-3 p-4">
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={isRegenerating}
            className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
          >
            {isRegenerating ? "Regenerando... (puede tardar un minuto)" : "Regenerar todo con IA"}
          </button>
          {saved && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
          {saveError && <span className="text-xs text-error">{saveError}</span>}
        </div>

        <Section title="Colores y tipografía" defaultOpen>
          <div className="grid grid-cols-3 gap-3">
            <ColorField
              label="Color principal (botones)"
              value={content.theme.primaryColor}
              onChange={(v) => setContent((c) => ({ ...c, theme: { ...c.theme, primaryColor: v } }))}
            />
            <ColorField
              label="Fondo"
              value={content.theme.backgroundColor}
              onChange={(v) => setContent((c) => ({ ...c, theme: { ...c.theme, backgroundColor: v } }))}
            />
            <ColorField
              label="Texto"
              value={content.theme.textColor}
              onChange={(v) => setContent((c) => ({ ...c, theme: { ...c.theme, textColor: v } }))}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <SelectField
              label="Fuente de títulos"
              value={content.theme.headingFont}
              options={FONT_OPTIONS}
              onChange={(v) => setContent((c) => ({ ...c, theme: { ...c.theme, headingFont: v as WebsiteContent["theme"]["headingFont"] } }))}
            />
            <SelectField
              label="Fuente de texto"
              value={content.theme.bodyFont}
              options={FONT_OPTIONS}
              onChange={(v) => setContent((c) => ({ ...c, theme: { ...c.theme, bodyFont: v as WebsiteContent["theme"]["bodyFont"] } }))}
            />
          </div>
        </Section>

        <Section title="Encabezado (hero)" defaultOpen>
          <TextField
            label="Título principal"
            value={content.hero.heading}
            onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, heading: v } }))}
          />
          <TextAreaField
            label="Subtítulo"
            value={content.hero.subheading}
            onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, subheading: v } }))}
          />
          <TextField
            label="Texto del botón"
            value={content.hero.ctaLabel}
            onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, ctaLabel: v } }))}
          />
          <TextField
            label="Link del botón (vacío = WhatsApp del negocio)"
            value={content.hero.ctaUrl ?? ""}
            onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, ctaUrl: v || null } }))}
          />
          {otherPages.length > 0 && (
            <div className="space-y-1">
              <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">
                O llévalo a otra de tus páginas
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setContent((c) => ({ ...c, hero: { ...c.hero, ctaUrl: e.target.value } }));
                  e.target.value = "";
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">Elegir página...</option>
                {otherPages.map((p) => (
                  <option key={p.publicUrl} value={p.publicUrl}>
                    {p.pageType === "agenda" ? "📅 " : ""}
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Section>

        <Section
          title={`Oferta (${content.offer.items.length})`}
          defaultOpen
          visible={content.visibleSections.offer}
          onToggleVisible={(v) => setContent((c) => ({ ...c, visibleSections: { ...c.visibleSections, offer: v } }))}
        >
          <TextField
            label="Título de la sección"
            value={content.offer.heading}
            onChange={(v) => setContent((c) => ({ ...c, offer: { ...c.offer, heading: v } }))}
          />
          <div className="space-y-3">
            {content.offer.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Servicio {i + 1}</span>
                  {content.offer.items.length > 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContent((c) => ({ ...c, offer: { ...c.offer, items: c.offer.items.filter((_, idx) => idx !== i) } }))
                      }
                      className="text-xs text-ink-faint hover:text-error"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      offer: { ...c.offer, items: c.offer.items.map((s, idx) => (idx === i ? { ...s, title: v } : s)) },
                    }))
                  }
                />
                <TextAreaField
                  label="Descripción"
                  value={item.description}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      offer: { ...c.offer, items: c.offer.items.map((s, idx) => (idx === i ? { ...s, description: v } : s)) },
                    }))
                  }
                />
              </div>
            ))}
            {content.offer.items.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({ ...c, offer: { ...c.offer, items: [...c.offer.items, { title: "", description: "" }] } }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar servicio
              </button>
            )}
          </div>
        </Section>

        <Section
          title={`Cómo funciona (${content.howItWorks.items.length})`}
          visible={content.visibleSections.howItWorks}
          onToggleVisible={(v) => setContent((c) => ({ ...c, visibleSections: { ...c.visibleSections, howItWorks: v } }))}
        >
          <TextField
            label="Título de la sección"
            value={content.howItWorks.heading}
            onChange={(v) => setContent((c) => ({ ...c, howItWorks: { ...c.howItWorks, heading: v } }))}
          />
          <div className="space-y-3">
            {content.howItWorks.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Paso {i + 1}</span>
                  {content.howItWorks.items.length > 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContent((c) => ({
                          ...c,
                          howItWorks: { ...c.howItWorks, items: c.howItWorks.items.filter((_, idx) => idx !== i) },
                        }))
                      }
                      className="text-xs text-ink-faint hover:text-error"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      howItWorks: {
                        ...c.howItWorks,
                        items: c.howItWorks.items.map((s, idx) => (idx === i ? { ...s, title: v } : s)),
                      },
                    }))
                  }
                />
                <TextAreaField
                  label="Descripción"
                  value={item.description}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      howItWorks: {
                        ...c.howItWorks,
                        items: c.howItWorks.items.map((s, idx) => (idx === i ? { ...s, description: v } : s)),
                      },
                    }))
                  }
                />
              </div>
            ))}
            {content.howItWorks.items.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    howItWorks: { ...c.howItWorks, items: [...c.howItWorks.items, { title: "", description: "" }] },
                  }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar paso
              </button>
            )}
          </div>
        </Section>

        <Section
          title={`Por qué elegirnos (${content.whyUs.items.length})`}
          visible={content.visibleSections.whyUs}
          onToggleVisible={(v) => setContent((c) => ({ ...c, visibleSections: { ...c.visibleSections, whyUs: v } }))}
        >
          <TextField
            label="Título de la sección"
            value={content.whyUs.heading}
            onChange={(v) => setContent((c) => ({ ...c, whyUs: { ...c.whyUs, heading: v } }))}
          />
          <div className="space-y-3">
            {content.whyUs.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Razón {i + 1}</span>
                  {content.whyUs.items.length > 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContent((c) => ({ ...c, whyUs: { ...c.whyUs, items: c.whyUs.items.filter((_, idx) => idx !== i) } }))
                      }
                      className="text-xs text-ink-faint hover:text-error"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      whyUs: { ...c.whyUs, items: c.whyUs.items.map((s, idx) => (idx === i ? { ...s, title: v } : s)) },
                    }))
                  }
                />
                <TextAreaField
                  label="Descripción"
                  value={item.description}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      whyUs: { ...c.whyUs, items: c.whyUs.items.map((s, idx) => (idx === i ? { ...s, description: v } : s)) },
                    }))
                  }
                />
              </div>
            ))}
            {content.whyUs.items.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({ ...c, whyUs: { ...c.whyUs, items: [...c.whyUs.items, { title: "", description: "" }] } }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar razón
              </button>
            )}
          </div>
        </Section>

        <Section
          title={`Objeciones (${content.objections.items.length})`}
          defaultOpen
          visible={content.visibleSections.objections}
          onToggleVisible={(v) => setContent((c) => ({ ...c, visibleSections: { ...c.visibleSections, objections: v } }))}
        >
          <p className="text-xs text-ink-muted">
            Las dudas reales que frenan la venta de este negocio, respondidas directamente — generadas a partir de
            conversaciones reales cuando hay datos suficientes.
          </p>
          <TextField
            label="Título de la sección"
            value={content.objections.heading}
            onChange={(v) => setContent((c) => ({ ...c, objections: { ...c.objections, heading: v } }))}
          />
          <div className="space-y-3">
            {content.objections.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Objeción {i + 1}</span>
                  {content.objections.items.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContent((c) => ({
                          ...c,
                          objections: { ...c.objections, items: c.objections.items.filter((_, idx) => idx !== i) },
                        }))
                      }
                      className="text-xs text-ink-faint hover:text-error"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <TextField
                  label="Duda / objeción"
                  value={item.question}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      objections: {
                        ...c.objections,
                        items: c.objections.items.map((x, idx) => (idx === i ? { ...x, question: v } : x)),
                      },
                    }))
                  }
                />
                <TextAreaField
                  label="Respuesta"
                  value={item.answer}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      objections: {
                        ...c.objections,
                        items: c.objections.items.map((x, idx) => (idx === i ? { ...x, answer: v } : x)),
                      },
                    }))
                  }
                />
              </div>
            ))}
            {content.objections.items.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    objections: { ...c.objections, items: [...c.objections.items, { question: "", answer: "" }] },
                  }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar objeción
              </button>
            )}
          </div>
        </Section>

        <Section title="Video (opcional)">
          <TextField
            label="Link de YouTube o Vimeo"
            value={content.videoUrl ?? ""}
            onChange={(v) => setContent((c) => ({ ...c, videoUrl: v || null }))}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Section>

        <Section
          title="Contacto"
          visible={content.visibleSections.contact}
          onToggleVisible={(v) => setContent((c) => ({ ...c, visibleSections: { ...c.visibleSections, contact: v } }))}
        >
          <TextField
            label="Título"
            value={content.contact.heading}
            onChange={(v) => setContent((c) => ({ ...c, contact: { ...c.contact, heading: v } }))}
          />
          <TextAreaField
            label="Texto"
            value={content.contact.body}
            onChange={(v) => setContent((c) => ({ ...c, contact: { ...c.contact, body: v } }))}
          />
        </Section>

        <DomainSection businessId={businessId} websiteId={websiteId} customDomain={customDomain} />
      </div>

      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <div className="fl-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-ink">Métricas del sitio</h2>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Visitas</p>
            <p className="text-2xl font-bold text-ink">{stats.totalViews}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Clics a WhatsApp</p>
              <p className="text-2xl font-bold text-accent">{stats.clicksWhatsapp}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Clics a agenda/link</p>
              <p className="text-2xl font-bold text-[rgb(var(--glow-secondary))]">{stats.clicksAgenda}</p>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            Van por separado a propósito: "WhatsApp" es cuando el botón usa el número del negocio; "Agenda/link" es
            cuando esta página tiene un link externo configurado (ver campo "Link del botón" arriba).
          </p>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Registros (datos dejados)</p>
            <p className="text-2xl font-bold text-ink">{leads.length}</p>
          </div>
          <p className="text-[11px] text-ink-faint">
            Personas que llenaron el formulario "Déjanos tus datos" de esta página. No incluye lo que agenden en un
            link externo de agenda — eso vive fuera de esta app y solo vemos el clic, no el registro.
          </p>
        </div>

        {leads.length > 0 && (
          <div className="fl-card space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Últimos registros</h2>
              <DownloadCsvButton
                filename="registros-sitio-web"
                headers={["Nombre", "Contacto", "Mensaje", "Fecha"]}
                rows={leads.map((lead) => [
                  lead.name,
                  lead.contact,
                  lead.message ?? "",
                  lead.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }),
                ])}
              />
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">{lead.name}</p>
                    <p className="fl-mono flex-none text-[10px] text-ink-faint">
                      {lead.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <p className="fl-mono text-xs text-accent">{lead.contact}</p>
                  {lead.message && <p className="mt-1 text-xs text-ink-muted">{lead.message}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fl-card space-y-2 p-4">
          <p className="text-xs text-ink-muted">
            Última versión: {generatedAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fl-mono flex-1 truncate text-xs text-accent underline-offset-2 hover:underline"
              title="Abrir el sitio real en una pestaña nueva"
            >
              {publicUrl}
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex-none text-xs font-medium text-ink-muted hover:text-ink"
            >
              {copied ? "✓" : "Copiar"}
            </button>
          </div>
        </div>
        <div className="fl-card overflow-hidden p-0">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Vista previa {isSaving ? "(guardando...)" : ""}
          </div>
          <iframe
            key={previewKey}
            src={`${publicUrl}?preview=1`}
            className="h-[70vh] w-full"
            title="Vista previa del sitio"
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  visible,
  onToggleVisible,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  // Omitted for sections that always render (hero, colors, video, domain) —
  // only the optional page sections (offer, howItWorks, whyUs, objections,
  // contact) pass these, showing a "Mostrar en el sitio" checkbox next to
  // the title so the owner can turn a section off without deleting its
  // content (see WebsiteContent.visibleSections).
  visible?: boolean;
  onToggleVisible?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="fl-card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        {onToggleVisible && (
          <label
            className="flex flex-none items-center gap-1.5 text-xs font-normal text-ink-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => onToggleVisible(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-accent"
            />
            Mostrar en el sitio
          </label>
        )}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">{label}</label>
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 flex-none cursor-pointer bg-transparent" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          placeholder="#1f6feb"
          title="Color en formato hex, ej. #1f6feb"
          className="fl-mono min-w-0 flex-1 bg-transparent text-xs text-ink outline-none"
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="fl-mono text-[10px] tracking-wide text-ink-muted uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// A subdomain's CNAME target is the same no matter which domain a client
// picks — every hostname on this Vercel project points here — so the DNS
// record can be shown the instant they save, with no Vercel API call and
// no waiting on the agency. The label is everything before the root domain's
// two parts (e.g. "pagina" out of "pagina.minegocio.com"); good enough for
// ordinary TLDs, see the label-count caveat on updateWebsiteCustomDomain.
const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

function cnameLabelFor(hostname: string): string {
  return hostname.split(".").slice(0, -2).join(".");
}

export function DomainSection({
  businessId,
  websiteId,
  customDomain,
}: {
  businessId: string;
  websiteId: string;
  customDomain: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedDomain, setSavedDomain] = useState<string | null>(customDomain);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateWebsiteCustomDomain(businessId, websiteId, formData);
      if (result.ok) {
        setError(null);
        setSavedDomain(String(formData.get("customDomain") ?? "").trim().toLowerCase() || null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Section title="Dominio propio (opcional)">
      <p className="text-xs text-ink-muted">
        ¿Quieres que esta página se vea en un subdominio tuyo (ej: pagina.tunegocio.com)? Escríbelo abajo — debe ser
        un subdominio, no tu dominio principal solo (así tu sitio actual nunca corre riesgo). Al guardar te
        mostramos el registro DNS para que lo crees tú mismo cuando quieras.
      </p>
      <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input
          name="customDomain"
          defaultValue={customDomain ?? ""}
          placeholder="pagina.tunegocio.com"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Solicitar"}
        </button>
      </form>
      {error && <p className="text-xs font-medium text-error">⚠ {error}</p>}
      {!error && savedDomain && (
        <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs font-semibold text-ink">
            Crea este registro en el proveedor donde compraste el dominio (GoDaddy, Namecheap, etc.):
          </p>
          <div className="fl-mono grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink">
            <span className="text-ink-muted">Tipo</span>
            <span>CNAME</span>
            <span className="text-ink-muted">Nombre / Host</span>
            <span>{cnameLabelFor(savedDomain) || "@"}</span>
            <span className="text-ink-muted">Valor</span>
            <span>{VERCEL_CNAME_TARGET}</span>
          </div>
          <p className="text-xs text-ink-muted">
            Puede tardar unas horas en activarse. Avísanos por WhatsApp cuando lo hayas creado para conectarlo de
            nuestro lado — sin ese paso, el registro solo no activa la página.
          </p>
        </div>
      )}
    </Section>
  );
}
