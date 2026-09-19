"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWebsiteContent, updateWebsiteCustomDomain, regenerateWebsitePage } from "@/lib/actions";
import { FONT_OPTIONS, type WebsiteContent } from "@/lib/websiteContent";

export function WebsiteEditor({
  businessId,
  websiteId,
  content: initialContent,
  customDomain,
  generatedAt,
  publicUrl,
}: {
  businessId: string;
  websiteId: string;
  content: WebsiteContent;
  customDomain: string | null;
  generatedAt: Date;
  publicUrl: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<WebsiteContent>(initialContent);
  const [isSaving, startSaving] = useTransition();
  const [isRegenerating, startRegenerating] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
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

        <Section title="Sobre el negocio">
          <TextField
            label="Título"
            value={content.about.heading}
            onChange={(v) => setContent((c) => ({ ...c, about: { ...c.about, heading: v } }))}
          />
          <TextAreaField
            label="Texto"
            value={content.about.body}
            onChange={(v) => setContent((c) => ({ ...c, about: { ...c.about, body: v } }))}
          />
        </Section>

        <Section title={`Servicios (${content.services.length})`}>
          <div className="space-y-3">
            {content.services.map((service, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Servicio {i + 1}</span>
                  {content.services.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContent((c) => ({ ...c, services: c.services.filter((_, idx) => idx !== i) }))
                      }
                      className="text-xs text-ink-faint hover:text-error"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <TextField
                  label="Título"
                  value={service.title}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      services: c.services.map((s, idx) => (idx === i ? { ...s, title: v } : s)),
                    }))
                  }
                />
                <TextAreaField
                  label="Descripción"
                  value={service.description}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      services: c.services.map((s, idx) => (idx === i ? { ...s, description: v } : s)),
                    }))
                  }
                />
              </div>
            ))}
            {content.services.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({ ...c, services: [...c.services, { title: "", description: "" }] }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar servicio
              </button>
            )}
          </div>
        </Section>

        <Section title={`Testimonios (${content.testimonials.length})`}>
          <div className="space-y-3">
            {content.testimonials.map((t, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="fl-mono text-[10px] uppercase text-ink-faint">Testimonio {i + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setContent((c) => ({ ...c, testimonials: c.testimonials.filter((_, idx) => idx !== i) }))
                    }
                    className="text-xs text-ink-faint hover:text-error"
                  >
                    Quitar
                  </button>
                </div>
                <TextAreaField
                  label="Cita"
                  value={t.quote}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      testimonials: c.testimonials.map((x, idx) => (idx === i ? { ...x, quote: v } : x)),
                    }))
                  }
                />
                <TextField
                  label="Autor"
                  value={t.author}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      testimonials: c.testimonials.map((x, idx) => (idx === i ? { ...x, author: v } : x)),
                    }))
                  }
                />
              </div>
            ))}
            {content.testimonials.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({ ...c, testimonials: [...c.testimonials, { quote: "", author: "" }] }))
                }
                className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
              >
                + Agregar testimonio
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
