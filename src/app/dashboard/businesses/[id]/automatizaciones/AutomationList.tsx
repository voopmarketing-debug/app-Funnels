"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askConfirm } from "@/components/ConfirmHost";
import { createAutomation, deleteAutomation, duplicateAutomation, setAutomationEnabled } from "@/lib/automations/automationActions";

export type AutomationRow = {
  id: string;
  name: string;
  enabled: boolean;
  triggers: string[];
  launches: number;
  completed: number;
  active: number;
};

const percent = (completed: number, launches: number) => (launches > 0 ? `${Math.round((completed / launches) * 100)}%` : "—");
const smallButton = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-40";

export function AutomationList({ businessId, rows, canEdit, whatsappConnected }: { businessId: string; rows: AutomationRow[]; canEdit: boolean; whatsappConnected: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (id: string | "new", action: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>, then?: (id?: string) => void) => {
    setError(null);
    setBusy(id);
    startTransition(async () => {
      const res = await action();
      setBusy(null);
      if (!res.ok) return setError(res.error);
      then?.("id" in res ? res.id : undefined);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run("new", () => createAutomation(businessId, name), (id) => id && router.push(`/dashboard/businesses/${businessId}/automatizaciones/${id}`));
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <label htmlFor="new-automation" className="sr-only">
                Nombre del flujo
              </label>
              <input id="new-automation" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej. Bienvenida a chats nuevos" className="w-72 max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
              <button type="submit" disabled={busy === "new" || !name.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50">
                {busy === "new" ? "Creando…" : "Crear"}
              </button>
              <button type="button" onClick={() => setCreating(false)} className={smallButton}>
                Cancelar
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">
              + Crear flujo
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-[#d03b3b]/40 bg-[#d03b3b]/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="fl-card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-ink">Todavía no tienes flujos</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Un flujo es una conversación que se arma sola: cuando pasa algo (llega un chat, el cliente escribe «precio», agenda una cita) tu WhatsApp responde con mensajes, botones y menús, hace preguntas, pone etiquetas y mueve al lead de etapa, sin que tengas que escribir.
          </p>
          <ul className="space-y-1 text-sm text-ink-muted">
            <li>✓ Dar la bienvenida a cada chat nuevo y preguntarle qué busca.</li>
            <li>✓ Pedir el correo y guardarlo en el contacto.</li>
            <li>✓ Seguir a quien no respondió, unas horas después.</li>
            <li>✓ Repartir los chats entre las personas de tu equipo.</li>
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface-2 text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold">Disparadores</th>
                <th className="px-4 py-3 text-right font-semibold" title="De cada 100 chats que entraron al flujo, cuántos llegaron hasta el final">
                  Tasa de conversión
                </th>
                <th className="px-4 py-3 text-right font-semibold">Lanzamientos</th>
                <th className="px-4 py-3 text-right font-semibold" title="Chats que están ahora dentro del flujo, esperando una respuesta o un tiempo">
                  Sesiones activas
                </th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {rows.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/businesses/${businessId}/automatizaciones/${r.id}`} className="font-semibold text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.triggers.length === 0 ? (
                      <span className="text-xs text-ink-faint">Sin disparador</span>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {r.triggers.map((t) => (
                          <li key={t} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-ink">
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{percent(r.completed, r.launches)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.launches.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.active.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label={`${r.enabled ? "Apagar" : "Encender"} el flujo ${r.name}`}
                      disabled={!canEdit || busy === r.id || (!r.enabled && !whatsappConnected)}
                      title={!r.enabled && !whatsappConnected ? "Conecta tu WhatsApp para encender flujos" : undefined}
                      onClick={() => run(r.id, () => setAutomationEnabled(businessId, r.id, !r.enabled))}
                      className={`relative h-6 w-11 rounded-full border align-middle transition disabled:opacity-60 ${r.enabled ? "border-accent bg-accent" : "border-border-strong bg-surface-2"}`}
                    >
                      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${r.enabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                    <span className="ml-2 text-xs text-ink-muted">{r.enabled ? "Encendido" : "Apagado"}</span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => duplicateAutomation(businessId, r.id))} className={smallButton}>
                          Duplicar
                        </button>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={async () => {
                            const sure = await askConfirm({
                              title: "Borrar flujo",
                              message: `Se borra «${r.name}» y los chats que estén dentro de él vuelven a la IA. No se puede deshacer.`,
                              confirmLabel: "Borrar",
                              tone: "danger",
                            });
                            if (sure) run(r.id, () => deleteAutomation(businessId, r.id));
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#d03b3b] transition hover:bg-[#d03b3b]/10 disabled:opacity-40"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
