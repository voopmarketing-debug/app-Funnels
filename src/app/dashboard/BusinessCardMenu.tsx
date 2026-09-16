"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessName, deleteBusiness } from "@/lib/actions";

export function BusinessCardMenu({
  businessId,
  currentName,
  canRename,
}: {
  businessId: string;
  currentName: string;
  canRename: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(currentName);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !editing && !deleting) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeAll();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, editing, deleting]);

  function closeAll() {
    setOpen(false);
    setEditing(false);
    setDeleting(false);
    setName(currentName);
    setConfirmName("");
    setError(null);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío");
      return;
    }
    startTransition(async () => {
      try {
        await updateBusinessName(businessId, trimmed);
        setOpen(false);
        setEditing(false);
        setError(null);
        router.refresh();
      } catch {
        setError("No se pudo guardar, intenta de nuevo");
      }
    });
  }

  function handleDelete() {
    if (confirmName.trim() !== currentName) {
      setError("El nombre no coincide — escríbelo exactamente igual.");
      return;
    }
    startTransition(async () => {
      try {
        await deleteBusiness(businessId);
        router.refresh();
      } catch {
        setError("No se pudo eliminar, intenta de nuevo.");
      }
    });
  }

  return (
    <div ref={containerRef} className="absolute right-2 top-2 z-10">
      <button
        type="button"
        onClick={() => (open ? closeAll() : setOpen(true))}
        aria-label="Opciones del negocio"
        className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-ink-muted transition hover:bg-background hover:text-ink"
      >
        ⋯
      </button>

      {open && !editing && !deleting && (
        <div className="absolute right-0 top-8 w-40 rounded-md border border-border bg-surface p-1 shadow-lg">
          {canRename && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-background"
            >
              Renombrar
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="w-full rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error/10"
          >
            Eliminar
          </button>
        </div>
      )}

      {editing && (
        <div className="absolute right-0 top-8 w-56 space-y-2 rounded-md border border-border bg-surface p-3 shadow-lg">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") closeAll();
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={closeAll} className="text-xs text-ink-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <div className="absolute right-0 top-8 w-64 space-y-2 rounded-md border border-error/50 bg-surface p-3 shadow-lg">
          <p className="text-xs text-ink-muted">
            Esto borra <span className="font-semibold text-ink">para siempre</span> el agente, sus conversaciones
            de WhatsApp y su CRM. Escribe <span className="font-semibold text-ink">{currentName}</span> para
            confirmar.
          </p>
          <input
            autoFocus
            value={confirmName}
            onChange={(e) => {
              setConfirmName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDelete();
              if (e.key === "Escape") closeAll();
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-error"
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="rounded-md bg-error px-2 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Eliminando..." : "Eliminar definitivamente"}
            </button>
            <button type="button" onClick={closeAll} className="text-xs text-ink-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
