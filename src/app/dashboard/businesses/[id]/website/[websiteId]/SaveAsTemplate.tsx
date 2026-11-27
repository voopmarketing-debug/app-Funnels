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
