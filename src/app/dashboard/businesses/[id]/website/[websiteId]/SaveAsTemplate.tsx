"use client";

import { useState, useTransition } from "react";
import { saveWebsiteAsTemplate } from "@/lib/actions";
import { DocIcon } from "./builderIcons";

/** Ajustes: saves a page with the owner's own HTML as a template of their account. */
export function SaveAsTemplate({ businessId, websiteId, defaultName }: { businessId: string; websiteId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveWebsiteAsTemplate(businessId, websiteId, name);
      setMsg(r.ok ? { ok: true, text: "Guardada en Plantillas, Mis plantillas." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
        <DocIcon className="h-3.5 w-3.5" />Guardar como plantilla
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nombre de la plantilla"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button type="button" disabled={pending || !name.trim()} onClick={save} className="flex-none rounded-md bg-accent px-3 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-ink-muted" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

/** The "Plantilla" button of the builder's top bar: a small window that saves the page as a template of the account. */
export function SaveTemplateDialog({ businessId, websiteId, defaultName, onClose }: { businessId: string; websiteId: string; defaultName: string; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveWebsiteAsTemplate(businessId, websiteId, name);
      setMsg(r.ok ? { ok: true, text: "Guardada. La encuentras en Plantillas, Mis plantillas." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Guardar como plantilla" className="fl-card-hero w-full max-w-sm space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <DocIcon className="h-4 w-4" />Guardar como plantilla
        </h2>
        <input
          autoFocus
          type="text"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && !pending && !msg?.ok && save()}
          aria-label="Nombre de la plantilla"
          placeholder="Nombre de la plantilla"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-ink" : "text-error"}`} role="status">
            {msg.text}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent">
            {msg?.ok ? "Cerrar" : "Cancelar"}
          </button>
          {!msg?.ok && (
            <button type="button" disabled={pending || !name.trim()} onClick={save} className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50">
              {pending ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
