"use client";

import { fromPanelUrl } from "@/lib/panelBackLink";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAgendaPage, deleteWebsitePage, renameWebsitePage } from "@/lib/actions";
import { AGENDA_STYLES, type AgendaStyle } from "@/lib/agendaStyles";
import { StyleCard } from "./[websiteId]/AgendaEditor";
import { ClientDate } from "@/components/ClientDate";
import { askConfirm } from "@/components/ConfirmHost";
import { DocIcon, TrendIcon } from "./[websiteId]/builderIcons";

type Page = {
  id: string;
  pageType: string;
  name: string;
  purpose: string | null;
  slug: string;
  generatedAt: Date;
  customDomain: string | null;
  viewCount: number;
  leadCount: number;
  hasTracking: boolean;
  // Which library template it came from, so pages from different templates can be compared.
  templateLabel?: string | null;
  published: boolean;
};

export function WebsitePagesList({
  businessId,
  pages,
  publicUrlBase,
  stats,
  onNewPage,
}: {
  businessId: string;
  pages: Page[];
  publicUrlBase: string;
  stats: { totalViews: number; totalClicksWhatsapp: number; totalClicksAgenda: number; totalLeads: number };
  // Opens the template library (the first screen of "Sitio web").
  onNewPage?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "agenda">("all");
  const shown = pages.filter((p) => {
    if (filter === "published" && !p.published) return false;
    if (filter === "draft" && p.published) return false;
    if (filter === "agenda" && p.pageType !== "agenda") return false;
    const q = query.trim().toLowerCase();
    return !q || `${p.name} ${p.slug} ${p.templateLabel ?? ""}`.toLowerCase().includes(q);
  });

  function openNewPageDialog() {
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }

  return (
    <div className="space-y-5">
      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <div className="relative w-full max-w-md flex-1">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <label htmlFor="pages-search" className="sr-only">
                Buscar mis sitios
              </label>
              <input
                id="pages-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar mis sitios…"
                className="h-11 w-full rounded-full border border-border bg-surface pr-4 pl-11 text-sm text-ink outline-none transition focus:border-border-strong"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar sitios">
              {(
                [
                  ["all", "Todos"],
                  ["published", "Publicados"],
                  ["draft", "Borradores"],
                  ["agenda", "Agendas"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`h-11 rounded-full border px-4 text-sm font-medium transition ${filter === key ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-2"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={onNewPage} className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover max-md:hidden">
                + Nueva página
              </button>
              <button type="button" onClick={openNewPageDialog} className="h-11 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-ink transition hover:border-border-strong hover:bg-surface-2">
                + Agenda
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                [<EyeIcon key="v" />, "Visitas", stats.totalViews],
                [<CursorIcon key="w" />, "Clics a WhatsApp", stats.totalClicksWhatsapp],
                [<CursorIcon key="a" />, "Clics a agenda o link", stats.totalClicksAgenda],
                [<FormIcon key="r" />, "Registros", stats.totalLeads],
              ] as const
            ).map(([icon, label, value]) => (
              <span key={label} className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pr-4 pl-2 text-[13px] text-ink-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-ink">{icon}</span>
                {label}
                <strong className="text-sm text-ink">{value}</strong>
              </span>
            ))}
          </div>
        </>
      )}

      <dialog ref={dialogRef} className="fl-card-hero w-full max-w-lg p-0">
        <NewPageDialog
          key={formKey}
          businessId={businessId}
          pageNumber={pages.length + 1}
          isFirstPage={pages.length === 0}
          onClose={() => dialogRef.current?.close()}
        />
      </dialog>

      {pages.length > 0 && shown.length > 0 && (
        <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((page) => (
            <PageCard key={page.id} businessId={businessId} page={page} publicUrl={`${publicUrlBase}/${page.slug}`} />
          ))}
        </div>
      )}
      {pages.length > 0 && shown.length === 0 && (
        <div className="fl-card p-8 text-center">
          <p className="text-sm font-semibold text-ink">No encontramos sitios con eso</p>
          <p className="mt-1 text-xs text-ink-muted">Prueba con otra palabra o cambia el filtro.</p>
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
              Elige una plantilla lista para tu tipo de negocio (contadores, estéticas, odontólogos…), mírala y publícala. Después la editas pidiéndole cambios por chat.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewPage}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgba(181,255,43,0.6)] transition hover:bg-accent-hover max-md:hidden"
          >
            Elegir una plantilla
          </button>
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

  const isAgenda = page.pageType === "agenda";
  return (
    <div className="group min-w-0">
      <Link href={editHref} className="block">
        {/* Live scaled-down render of the real page — no screenshot service needed: the iframe renders at 4x the
            box size then is scaled to 25%, so it always fills the box exactly regardless of card width.
            ?preview=1 keeps this thumbnail from counting as a real visit every time the owner opens this
            list — see the matching check in app/sitio/[slug]/route.ts. */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[20px] border border-border bg-surface transition group-hover:border-border-strong group-hover:shadow-lg">
          <iframe
            src={`${publicUrl}?preview=1`}
            loading="lazy"
            tabIndex={-1}
            title={page.name}
            className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-[0.25]"
          />
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${page.published ? "bg-black/55 text-white" : "bg-amber-400/90 text-black"}`}>{page.published ? "Publicado" : "Borrador"}</span>
            {isAgenda && <span className="rounded-full bg-violet-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">Agenda</span>}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
            <span className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-lg">Editar</span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-start gap-3 px-0.5">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${isAgenda ? "bg-violet-500/15 text-violet-500" : "bg-accent/15 text-accent"}`} aria-hidden="true">
          {isAgenda ? <CalendarIcon /> : <GlobeIcon />}
        </span>
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
            <button type="button" onClick={startEditingName} title="Renombrar esta página — por ejemplo, qué paso de tu embudo es" className="group/name flex max-w-full items-center gap-1.5 text-left">
              <span className="truncate text-[15px] font-semibold text-ink">{page.name}</span>
              <PencilIcon className="flex-none text-ink-faint opacity-0 transition group-hover/name:opacity-100 [@media(pointer:coarse)]:opacity-100" />
            </button>
          )}
          {renameError && <p className="mt-0.5 text-xs text-error">{renameError}</p>}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
            <span>
              Editado <ClientDate date={page.generatedAt} options={{ day: "numeric", month: "short" }} />
            </span>
            <span className="flex items-center gap-1" title="Visitas">
              <EyeIcon /> {page.viewCount}
            </span>
            <span className="flex items-center gap-1" title="Registros">
              <FormIcon /> {page.leadCount}
            </span>
          </p>
          {page.purpose && <p className="mt-0.5 truncate text-xs text-ink-muted">{page.purpose}</p>}
          {page.templateLabel && (
            <p className="mt-0.5 truncate text-xs text-ink-faint">
              <DocIcon className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
              Plantilla: {page.templateLabel}
            </p>
          )}
          <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-0.5 block truncate text-xs text-ink-faint hover:text-accent hover:underline">
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
          {page.customDomain && <p className="mt-0.5 truncate text-xs text-accent">{page.customDomain}</p>}
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {/* Shortcut to the Meta Pixel / Google tag settings, which live in the editor (Ajustes) and were easy to miss. */}
          <Link
            href={`${editHref}?tab=ajustes#pixel`}
            title="Píxel de Meta y etiqueta de Google para medir tus anuncios"
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              page.hasTracking ? "bg-[var(--status-good)]/15 text-[var(--status-good)] hover:bg-[var(--status-good)]/25" : "border border-border text-ink-muted hover:border-border-strong hover:text-ink"
            }`}
          >
            {page.hasTracking ? "Píxel activo" : <><TrendIcon className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />Píxel</>}
          </Link>
          <button
            type="button"
            disabled={isDeleting}
            onClick={async () => {
              if (await askConfirm({ title: `¿Eliminar la página "${page.name}"?`, message: "Esto no se puede deshacer.", confirmLabel: "Sí, eliminar", tone: "danger" })) {
                startTransition(async () => {
                  await deleteWebsitePage(businessId, page.id);
                  router.refresh();
                });
              }
            }}
            className="rounded-md px-1 text-xs text-ink-muted transition hover:text-error disabled:opacity-60"
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.500" rx="3" />
      <path d="M8 3v4M16 3v4M3.500 10h17" />
    </svg>
  );
}

type FormState = { error: string | null };
const INITIAL_STATE: FormState = { error: null };

// A new page is always an agenda (a real booking calendar, see lib/agendaTemplate.ts): pages with
// content come from the template library, not from here. It asks for a name and a look; hours,
// services, address and the rest are set afterwards in the agenda's own editor.
function NewPageDialog({
  businessId,
  pageNumber,
  onClose,
}: {
  businessId: string;
  pageNumber: number;
  isFirstPage?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [style, setStyle] = useState<AgendaStyle>("cielo");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();

    startTransition(async () => {
      try {
        const { id } = await createAgendaPage(businessId, { name: name || undefined, style });
        onClose();
        router.push(`/dashboard/businesses/${businessId}/website/${id}`);
      } catch (err) {
        setState({ error: err instanceof Error ? err.message : "No se pudo crear la agenda" });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-ink">Nueva agenda (Página {pageNumber})</h2>
        <p className="text-sm text-ink-muted">Tus clientes eligen día y hora y quedan agendados.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Nombre (opcional)
        </label>
        <input
          id="name"
          name="name"
          placeholder="Ej: Agenda tu cita"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <p className="fl-mono text-xs tracking-wide text-ink-muted uppercase">Estilo</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AGENDA_STYLES.map((id) => (
            <StyleCard key={id} id={id} accent="#1f6feb" selected={style === id} onSelect={() => setStyle(id)} />
          ))}
        </div>
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
          {isPending ? "Creando..." : "Crear agenda"}
        </button>
      </div>
    </form>
  );
}
