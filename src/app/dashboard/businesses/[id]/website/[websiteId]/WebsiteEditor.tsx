"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWebsiteContent, updateWebsiteCustomDomain, regenerateWebsitePage, applyWebsitePrompt } from "@/lib/actions";
import { FONT_OPTIONS, type WebsiteContent } from "@/lib/websiteContent";

export function WebsiteEditor({
  businessId,
  websiteId,
  content: initialContent,
  customDomain,
  generatedAt,
  publicUrl,
  stats,
}: {
  businessId: string;
  websiteId: string;
  content: WebsiteContent;
  customDomain: string | null;
  generatedAt: Date;
  publicUrl: string;
  stats: { totalViews: number; clicksWhatsapp: number; clicksAgenda: number };
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
        setTimeout(() => setPromptApplied(false), 2500);
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
            "agrega una sección de preguntas frecuentes", "hazlo sonar más formal". La IA hace el cambio directo en
            la página.
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
              {isApplyingPrompt ? "Aplicando..." : "Aplicar cambio"}
            </button>
            {promptApplied && <span className="fl-mono text-xs text-accent">✓ Cambio aplicado y guardado</span>}
            {promptError && <span className="text-xs text-error">{promptError}</span>}
          </div>
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
        </Section>

        <Section title={`Oferta (${content.offer.items.length})`} defaultOpen>
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

        <Section title={`Objeciones (${content.objections.items.length})`} defaultOpen>
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

        <Section title="Contacto">
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
        </div>

        <div className="fl-card space-y-2 p-4">
          <p className="text-xs text-ink-muted">
            Última versión: {generatedAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <code className="fl-mono flex-1 truncate text-xs text-accent">{publicUrl}</code>
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
          <iframe key={previewKey} src={publicUrl} className="h-[70vh] w-full" title="Vista previa del sitio" />
        </div>
      </div>
    </div>
  );
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="fl-card group p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
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

function DomainSection({
  businessId,
  websiteId,
  customDomain,
}: {
  businessId: string;
  websiteId: string;
  customDomain: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateWebsiteCustomDomain(businessId, websiteId, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Section title="Dominio propio (opcional)">
      <p className="text-xs text-ink-muted">
        ¿Quieres que esta página se vea en tu propio dominio (como minegocio.com) o en un subdominio dedicado (como
        minegocio.funnelslabs.app)? Escríbelo abajo — es un paso de DNS que conectamos nosotros manualmente y te
        avisamos por WhatsApp cuando quede activo.
      </p>
      <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input
          name="customDomain"
          defaultValue={customDomain ?? ""}
          placeholder="minegocio.com"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Solicitar"}
        </button>
        {saved && !isPending && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
      </form>
    </Section>
  );
}
