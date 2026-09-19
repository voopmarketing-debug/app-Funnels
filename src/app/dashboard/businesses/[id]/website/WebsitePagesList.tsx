"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createWebsitePage, deleteWebsitePage } from "@/lib/actions";

type Page = {
  id: string;
  name: string;
  purpose: string | null;
  slug: string;
  generatedAt: Date;
  customDomain: string | null;
  viewCount: number;
};

export function WebsitePagesList({
  businessId,
  hasWabaCredentials,
  pages,
  publicUrlBase,
  stats,
}: {
  businessId: string;
  hasWabaCredentials: boolean;
  pages: Page[];
  publicUrlBase: string;
  stats: { totalViews: number; totalClicksWhatsapp: number; totalClicksAgenda: number };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-5">
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
        </div>

        <button
          type="button"
          onClick={() => {
            setFormKey((k) => k + 1);
            dialogRef.current?.showModal();
          }}
          disabled={!hasWabaCredentials}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover disabled:opacity-50"
        >
          + Nueva página
        </button>
      </div>

      {!hasWabaCredentials && (
        <div className="rounded-md border-2 border-[#fab219]/50 bg-surface p-4 text-sm text-ink">
          Conecta primero las credenciales de WhatsApp de este negocio (página del negocio) — cada página usa ese
          número real para el botón de contacto.
        </div>
      )}

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-md p-0">
        <NewPageForm key={formKey} businessId={businessId} onClose={() => dialogRef.current?.close()} />
      </dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <PageCard key={page.id} businessId={businessId} page={page} publicUrl={`${publicUrlBase}/${page.slug}`} />
        ))}
      </div>

      {pages.length === 0 && hasWabaCredentials && (
        <div className="fl-card flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <GlobeIcon />
          </span>
          <p className="text-sm font-medium text-ink">Todavía no has creado ninguna página</p>
          <p className="max-w-xs text-xs text-ink-muted">
            Dale a "+ Nueva página" y en un minuto tienes un sitio listo, generado con IA para este negocio.
          </p>
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

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PageCard({ businessId, page, publicUrl }: { businessId: string; page: Page; publicUrl: string }) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();
  const editHref = `/dashboard/businesses/${businessId}/website/${page.id}`;

  return (
    <div className="fl-card fl-card-hover group overflow-hidden">
      <Link href={editHref} className="block">
        {/* Live scaled-down render of the real page — no screenshot service
            needed: the iframe renders at 4x the box size then is scaled to
            25%, so it always fills the box exactly regardless of card width. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-background">
          <iframe
            src={publicUrl}
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
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{page.name}</p>
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
          <span className="text-ink-faint">
            {page.generatedAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
          </span>
          {page.customDomain && <span className="fl-mono text-accent">{page.customDomain}</span>}
        </div>
      </div>
    </div>
  );
}

type FormState = { error: string | null; createdId: string | null };
const INITIAL_STATE: FormState = { error: null, createdId: null };

function NewPageForm({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const purpose = String(formData.get("purpose") ?? "").trim();
    const ctaUrl = String(formData.get("ctaUrl") ?? "").trim();

    startTransition(async () => {
      try {
        const { id } = await createWebsitePage(businessId, { name, purpose: purpose || undefined, ctaUrl: ctaUrl || undefined });
        onClose();
        router.push(`/dashboard/businesses/${businessId}/website/${id}`);
      } catch (err) {
        setState({ error: err instanceof Error ? err.message : "No se pudo crear la página", createdId: null });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">Nueva página</h2>
        <p className="text-sm text-ink-muted">
          Crea todas las que necesites: un sitio principal, una página para que agenden una demo, una oferta puntual
          — cada una con su propio objetivo.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre (para identificarla en tu panel)
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Sitio principal"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
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

      <div className="space-y-1">
        <label htmlFor="ctaUrl" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Link externo del botón principal (opcional)
        </label>
        <p className="text-[11px] text-ink-faint">
          Si lo dejas vacío, el botón lleva automáticamente al WhatsApp del negocio. Solo llénalo si quieres que
          lleve a otro lado, como tu agenda.
        </p>
        <input
          id="ctaUrl"
          name="ctaUrl"
          placeholder="https://agenda.funnelslabs.app/agenda"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
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
          {isPending ? "Generando... (puede tardar un minuto)" : "Crear página"}
        </button>
      </div>
    </form>
  );
}
