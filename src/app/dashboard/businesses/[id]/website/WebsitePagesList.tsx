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
  stats: { totalViews: number; totalClicks: number };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-4">
      {pages.length > 0 && (
        <div className="fl-card grid grid-cols-2 gap-3 p-4 sm:max-w-sm">
          <div>
            <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Visitas totales</p>
            <p className="text-2xl font-bold text-ink">{stats.totalViews}</p>
          </div>
          <div>
            <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">Clics totales</p>
            <p className="text-2xl font-bold text-accent">{stats.totalClicks}</p>
          </div>
        </div>
      )}

      {!hasWabaCredentials && (
        <div className="rounded-md border-2 border-[#fab219]/50 bg-surface p-4 text-sm text-ink">
          Conecta primero las credenciales de WhatsApp de este negocio (página del negocio) — cada página usa ese
          número real para el botón de contacto.
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        disabled={!hasWabaCredentials}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
      >
        + Nueva página
      </button>

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-md p-0">
        <NewPageForm key={formKey} businessId={businessId} onClose={() => dialogRef.current?.close()} />
      </dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <PageCard key={page.id} businessId={businessId} page={page} publicUrl={`${publicUrlBase}/${page.slug}`} />
        ))}
      </div>

      {pages.length === 0 && hasWabaCredentials && (
        <p className="fl-card p-4 text-center text-sm text-ink-muted">Todavía no has creado ninguna página.</p>
      )}
    </div>
  );
}

function PageCard({ businessId, page, publicUrl }: { businessId: string; page: Page; publicUrl: string }) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();

  return (
    <div className="fl-card space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{page.name}</p>
          {page.purpose && <p className="mt-0.5 text-xs text-ink-muted">{page.purpose}</p>}
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
        className="fl-mono block truncate text-xs text-accent hover:underline"
      >
        {publicUrl}
      </a>

      <div className="flex items-center gap-3 pt-1">
        <Link
          href={`/dashboard/businesses/${businessId}/website/${page.id}`}
          className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent"
        >
          Editar
        </Link>
        <span className="text-[11px] text-ink-faint">
          {page.generatedAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
        </span>
        <span className="fl-mono text-[11px] text-ink-muted">{page.viewCount} visitas</span>
        {page.customDomain && <span className="fl-mono text-[11px] text-accent">{page.customDomain}</span>}
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
