"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  deleteAnnouncement,
  moveAnnouncement,
  saveAnnouncement,
  toggleAnnouncementPublished,
  type SaveAnnouncementState,
} from "@/lib/announcementActions";
import { AnnouncementBanner, NewsCard } from "../AnnouncementViews";

export type AdminAnnouncement = {
  id: string;
  kind: "BANNER" | "NEWS";
  title: string;
  body: string;
  badge: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  published: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type Draft = Omit<AdminAnnouncement, "id"> & { id: string | null };

const EMPTY: Record<"BANNER" | "NEWS", Draft> = {
  BANNER: {
    id: null,
    kind: "BANNER",
    title: "",
    body: "",
    badge: "Nuevo",
    imageUrl: null,
    ctaLabel: "",
    ctaUrl: "",
    published: true,
    startsAt: null,
    endsAt: null,
  },
  NEWS: {
    id: null,
    kind: "NEWS",
    title: "",
    body: "",
    badge: "Novedad",
    imageUrl: null,
    ctaLabel: "",
    ctaUrl: "",
    published: true,
    startsAt: null,
    endsAt: null,
  },
};

/** ISO → value for <input type="datetime-local"> in the viewer's own timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusOf(a: AdminAnnouncement, now: number): { label: string; className: string } {
  if (!a.published) return { label: "Borrador", className: "bg-surface-2 text-ink-muted" };
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return { label: "Programado", className: "bg-[#3987e526] text-[#3987e5]" };
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return { label: "Vencido", className: "bg-error/15 text-error" };
  return { label: "Publicado", className: "bg-accent/15 text-accent" };
}

export function AnnouncementManager({ items }: { items: AdminAnnouncement[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Captured once per mount (not during render) so status chips are stable.
  const [now] = useState(() => Date.now());

  function openEditor(next: Draft) {
    setDraft(next);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const banners = items.filter((i) => i.kind === "BANNER");
  const news = items.filter((i) => i.kind === "NEWS");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openEditor(EMPTY.BANNER)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          ＋ Nuevo banner
        </button>
        <button
          type="button"
          onClick={() => openEditor(EMPTY.NEWS)}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          ＋ Nueva novedad
        </button>
      </div>

      {draft && (
        <div ref={editorRef}>
          <AnnouncementEditor key={draft.id ?? `new-${draft.kind}`} draft={draft} onDone={() => setDraft(null)} />
        </div>
      )}

      <AnnouncementList title="Banners" empty="Todavía no hay banners. Crea uno para destacar una campaña o lanzamiento." items={banners} now={now} onEdit={openEditor} />
      <AnnouncementList title="Novedades" empty="Todavía no hay novedades publicadas." items={news} now={now} onEdit={openEditor} />
    </div>
  );
}

function AnnouncementList({
  title,
  empty,
  items,
  now,
  onEdit,
}: {
  title: string;
  empty: string;
  items: AdminAnnouncement[];
  now: number;
  onEdit: (d: Draft) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<void>) => startTransition(fn);

  return (
    <section className="space-y-2">
      <h2 className="fl-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      {items.length === 0 ? (
        <p className="fl-card p-4 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className={`space-y-2 ${isPending ? "opacity-60" : ""}`}>
          {items.map((a, i) => {
            const status = statusOf(a, now);
            return (
              <li key={a.id} className="fl-card flex flex-wrap items-center gap-3 p-3">
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Vercel Blob URL
                  <img src={a.imageUrl} alt="" className="h-12 w-16 flex-none rounded-md object-cover" />
                ) : (
                  <div className="flex h-12 w-16 flex-none items-center justify-center rounded-md bg-surface-2 text-lg">📣</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                  <p className="truncate text-xs text-ink-muted">{a.body}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                <div className="flex flex-none items-center gap-1">
                  <IconButton label="Subir" disabled={i === 0} onClick={() => run(() => moveAnnouncement(a.id, "up"))}>
                    ↑
                  </IconButton>
                  <IconButton label="Bajar" disabled={i === items.length - 1} onClick={() => run(() => moveAnnouncement(a.id, "down"))}>
                    ↓
                  </IconButton>
                  <button
                    type="button"
                    onClick={() => run(() => toggleAnnouncementPublished(a.id))}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink"
                  >
                    {a.published ? "Ocultar" : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(a)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent hover:text-accent"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm(`¿Eliminar "${a.title}"? Esta acción no se puede deshacer.`) && run(() => deleteAnnouncement(a.id))}
                    className="rounded-md px-2 py-1 text-xs text-ink-faint transition hover:text-error"
                    aria-label="Eliminar"
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const INITIAL_STATE: SaveAnnouncementState = { error: null, savedAt: null };

function AnnouncementEditor({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(saveAnnouncement, INITIAL_STATE);
  const [, startSubmit] = useTransition();
  // Submitted via onSubmit rather than <form action>: React resets a form
  // after an action-prop submission, which wiped every field whenever the
  // server returned a validation error (e.g. a bad link) — the admin had to
  // retype everything just to fix one field.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startSubmit(() => formAction(data));
  }
  const [preview, setPreview] = useState(draft);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  useEffect(() => () => {
    if (localImage) URL.revokeObjectURL(localImage);
  }, [localImage]);

  const set = (patch: Partial<Draft>) => setPreview((p) => ({ ...p, ...patch }));
  const shownImage = removeImage ? null : (localImage ?? preview.imageUrl);
  const previewView = {
    id: preview.id ?? "preview",
    title: preview.title || "Título de ejemplo",
    body: preview.body || "Aquí va el texto que verán tus clientes.",
    badge: preview.badge || null,
    imageUrl: shownImage,
    ctaLabel: preview.ctaLabel || null,
    ctaUrl: preview.ctaUrl || null,
  };

  const input =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";

  return (
    <div className="fl-card grid gap-6 p-4 md:p-5 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          {draft.id ? "Editar" : "Crear"} {draft.kind === "BANNER" ? "banner" : "novedad"}
        </h2>
        {draft.id && <input type="hidden" name="id" value={draft.id} />}
        <input type="hidden" name="kind" value={draft.kind} />
        <input type="hidden" name="imageUrl" value={preview.imageUrl ?? ""} />
        {removeImage && <input type="hidden" name="removeImage" value="1" />}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Título *</span>
          <input name="title" required maxLength={120} defaultValue={draft.title} onChange={(e) => set({ title: e.target.value })} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Texto *</span>
          <textarea name="body" required rows={3} maxLength={600} defaultValue={draft.body} onChange={(e) => set({ body: e.target.value })} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Etiqueta</span>
            <input name="badge" maxLength={20} placeholder="Nuevo, Promo…" defaultValue={draft.badge ?? ""} onChange={(e) => set({ badge: e.target.value })} className={input} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Texto del botón</span>
            <input name="ctaLabel" maxLength={40} placeholder="Probar ahora" defaultValue={draft.ctaLabel ?? ""} onChange={(e) => set({ ctaLabel: e.target.value })} className={input} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Enlace del botón</span>
          <input
            name="ctaUrl"
            placeholder="https://… o /dashboard/agentes"
            defaultValue={draft.ctaUrl ?? ""}
            onChange={(e) => set({ ctaUrl: e.target.value })}
            className={input}
          />
        </label>

        <div className="space-y-1">
          <span className="text-xs font-medium text-ink-muted">Imagen (JPG, PNG o WEBP, máx. 3,5 MB)</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-ink">
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setRemoveImage(false);
                  setLocalImage(file ? URL.createObjectURL(file) : null);
                }}
              />
              {shownImage ? "Cambiar imagen" : "Subir imagen"}
            </label>
            {shownImage && (
              <button type="button" onClick={() => setRemoveImage(true)} className="text-xs text-ink-faint hover:text-error">
                Quitar imagen
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Mostrar desde</span>
            <input type="datetime-local" name="startsAt" defaultValue={toLocalInput(draft.startsAt)} className={input} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Mostrar hasta</span>
            <input type="datetime-local" name="endsAt" defaultValue={toLocalInput(draft.endsAt)} className={input} />
          </label>
        </div>
        <p className="text-[11px] text-ink-faint">Déjalas vacías para mostrarlo desde ya y sin fecha de fin.</p>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="published" defaultChecked={draft.published} className="h-4 w-4 accent-[var(--accent)]" />
          Publicado (visible para los clientes)
        </label>

        {state.error && <p className="text-xs font-medium text-error">{state.error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={onDone} className="rounded-md border border-border px-4 py-2 text-sm text-ink-muted hover:text-ink">
            Cancelar
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <p className="fl-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Vista previa</p>
        {draft.kind === "BANNER" ? (
          <AnnouncementBanner announcement={previewView} preview />
        ) : (
          <div className="max-w-xs">
            <NewsCard item={previewView} />
          </div>
        )}
      </div>
    </div>
  );
}
