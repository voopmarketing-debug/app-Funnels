"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWebsitePage, deleteWebsitePage, renameWebsitePage } from "@/lib/actions";

type Page = {
  id: string;
  name: string;
  purpose: string | null;
  slug: string;
  generatedAt: Date;
  customDomain: string | null;
  viewCount: number;
  leadCount: number;
};

export function WebsitePagesList({
  businessId,
  pages,
  publicUrlBase,
  stats,
}: {
  businessId: string;
  pages: Page[];
  publicUrlBase: string;
  stats: { totalViews: number; totalClicksWhatsapp: number; totalClicksAgenda: number; totalLeads: number };
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [isGenerating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  function generateFirstSite() {
    setGenerateError(null);
    startGenerating(async () => {
      try {
        const { id } = await createWebsitePage(businessId, {});
        router.push(`/dashboard/businesses/${businessId}/website/${id}`);
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : "No se pudo generar el sitio");
      }
    });
  }

  return (
    <div className="space-y-5">
      {pages.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="fl-card flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(var(--glow-blue),0.15)] text-[rgb(var(--glow-blue))]">
                <EyeIcon />
              </span>
              <div>
                <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Visitas totales</p>
                <p className="text-xl font-bold text-ink">{stats.totalViews}</p>
              </div>
            </div>
            <div className="fl-card flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent">
                <CursorIcon />
              </span>
              <div>
                <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Clics a WhatsApp</p>
                <p className="text-xl font-bold text-accent">{stats.totalClicksWhatsapp}</p>
              </div>
            </div>
            <div className="fl-card flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(var(--glow-secondary),0.15)] text-[rgb(var(--glow-secondary))]">
                <CursorIcon />
              </span>
              <div>
                <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Clics a agenda/link</p>
                <p className="text-xl font-bold text-[rgb(var(--glow-secondary))]">{stats.totalClicksAgenda}</p>
              </div>
            </div>
            <div className="fl-card flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(var(--glow-blue),0.15)] text-[rgb(var(--glow-blue))]">
                <FormIcon />
              </span>
              <div>
                <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Registros</p>
                <p className="text-xl font-bold text-ink">{stats.totalLeads}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormKey((k) => k + 1);
              dialogRef.current?.showModal();
            }}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover disabled:opacity-50"
          >
            + Nueva página
          </button>
        </div>
      )}

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-md p-0">
        <NewPageForm key={formKey} businessId={businessId} pageNumber={pages.length + 1} onClose={() => dialogRef.current?.close()} />
      </dialog>

      {pages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <PageCard key={page.id} businessId={businessId} page={page} publicUrl={`${publicUrlBase}/${page.slug}`} />
          ))}
        </div>
      )}

      {pages.length === 0 && (
        <div className="fl-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <GlobeIcon />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Este negocio todavía no tiene sitio web</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">
              Un clic y la IA arma la página completa — después puedes editar todo (textos, colores, link) o pedirle
              cambios con IA.
            </p>
          </div>
          <button
            type="button"
            onClick={generateFirstSite}
            disabled={isGenerating}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isGenerating ? "Generando... (puede tardar un minuto)" : "✨ Generar sitio web"}
          </button>
          {generateError && <p className="text-xs text-error">{generateError}</p>}
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="m6 4 3.5 13.5 2-4.8 4.8-2L6 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M16 16.5 19 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FormIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 9h9M7.5 13h9M7.5 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="m16.5 3.5 4 4L8 20 3.5 20.5 4 16 16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PageCard({ businessId, page, publicUrl }: { businessId: string; page: Page; publicUrl: string }) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();
  const [isRenaming, startRenaming] = useTransition();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(page.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editHref = `/dashboard/businesses/${businessId}/website/${page.id}`;

  function startEditingName() {
    setNameValue(page.name);
    setRenameError(null);
    setIsEditingName(true);
    // Wait for the input to mount before focusing it.
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === page.name) {
      setIsEditingName(false);
      return;
    }
    startRenaming(async () => {
      try {
        await renameWebsitePage(businessId, page.id, trimmed);
        setIsEditingName(false);
        router.refresh();
      } catch (err) {
        setRenameError(err instanceof Error ? err.message : "No se pudo guardar el nombre");
      }
    });
  }

  return (
    <div className="fl-card fl-card-hover group overflow-hidden">
      <Link href={editHref} className="block">
        {/* Live scaled-down render of the real page — no screenshot service
            needed: the iframe renders at 4x the box size then is scaled to
            25%, so it always fills the box exactly regardless of card width.
            ?preview=1 keeps this thumbnail from counting as a real visit
            every time the owner opens this list — see the matching check in
            app/sitio/[slug]/route.ts. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-background">
          <iframe
            src={`${publicUrl}?preview=1`}
            loading="lazy"
            tabIndex={-1}
            title={page.name}
            className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-[0.25]"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition group-hover:bg-ink/10 group-hover:opacity-100">
            <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-lg">
              Editar página
            </span>
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                  }
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                disabled={isRenaming}
                maxLength={60}
                className="w-full rounded border border-accent bg-background px-1.5 py-0.5 font-semibold text-ink outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingName}
                title="Renombrar esta página — por ejemplo, qué paso de tu embudo es"
                className="group/name flex max-w-full items-center gap-1.5 text-left"
              >
                <span className="truncate font-semibold text-ink">{page.name}</span>
                <PencilIcon className="flex-none text-ink-faint opacity-0 transition group-hover/name:opacity-100" />
              </button>
            )}
            {renameError && <p className="mt-0.5 text-xs text-error">{renameError}</p>}
            {page.purpose && <p className="mt-0.5 truncate text-xs text-ink-muted">{page.purpose}</p>}
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => {
              if (confirm(`¿Eliminar la página "${page.name}"? Esto no se puede deshacer.`)) {
                startTransition(async () => {
                  await deleteWebsitePage(businessId, page.id);
                  router.refresh();
                });
              }
            }}
            className="flex-none text-xs text-ink-faint hover:text-error"
          >
            Eliminar
          </button>
        </div>

        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="fl-mono block truncate text-xs text-accent hover:underline"
        >
          {publicUrl}
        </a>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px]">
          <span className="fl-mono flex items-center gap-1 text-ink-muted">
            <EyeIcon /> {page.viewCount}
          </span>
          <span className="fl-mono flex items-center gap-1 text-ink-muted">
            <FormIcon /> {page.leadCount}
          </span>
          <span className="text-ink-faint">
            {page.generatedAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
          </span>
          {page.customDomain && <span className="fl-mono text-accent">{page.customDomain}</span>}
        </div>
      </div>
    </div>
  );
}

type FormState = { error: string | null };
const INITIAL_STATE: FormState = { error: null };

// Only asks for what actually changes the generated copy (the page's
// purpose) — no name field here (auto-numbered at creation so there's
// nothing to invent up front; renaming it to something like "Paso 2 —
// Agendar demo" happens afterward, straight from the card — see
// PageCard's inline rename) and no link field (that's editable afterward,
// in the page's own editor, alongside everything else).
function NewPageForm({
  businessId,
  pageNumber,
  onClose,
}: {
  businessId: string;
  pageNumber: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const purpose = String(formData.get("purpose") ?? "").trim();

    startTransition(async () => {
      try {
        const { id } = await createWebsitePage(businessId, { purpose: purpose || undefined });
        onClose();
        router.push(`/dashboard/businesses/${businessId}/website/${id}`);
      } catch (err) {
        setState({ error: err instanceof Error ? err.message : "No se pudo crear la página" });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">Nueva página (Página {pageNumber})</h2>
        <p className="text-sm text-ink-muted">
          Para qué es esta página además de la principal — por ejemplo, que el visitante agende una demo, o una
          oferta puntual. La IA ajusta el texto y el botón a eso.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="purpose" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Objetivo de esta página (opcional)
        </label>
        <textarea
          id="purpose"
          name="purpose"
          rows={2}
          placeholder="Ej: que el visitante agende una demo con nosotros"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Generando... (puede tardar un minuto)" : "✨ Generar página"}
        </button>
      </div>
    </form>
  );
}
