"use client";

import Link from "next/link";
import { stageStyle } from "@/lib/crmStages";
import { contactInitial, contactLabel, formatPhone } from "@/lib/contactDisplay";
import { DownloadCsvButton } from "@/components/DownloadCsvButton";
import type { CrmStage, CrmConversation } from "./CrmBoard";
import { useListTimeFormatter } from "./crm/crmDisplay";

function csvDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Kommo-style contacts list: one clean row per contact, the CSV export
// always matches what's on screen (i.e. respects the active filters).
export function ContactsTable({
  businessId,
  stages,
  conversations,
}: {
  businessId: string;
  stages: CrmStage[];
  conversations: CrmConversation[];
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const formatTime = useListTimeFormatter();

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DownloadCsvButton
          filename="contactos"
          headers={["Nombre", "Teléfono", "Correo", "Etapa", "Etiquetas", "Creado", "Última actividad"]}
          rows={conversations.map((c) => [
            c.customerName ?? "",
            c.customerPhone,
            c.customerEmail ?? "",
            stageById.get(c.stageId)?.name ?? "",
            (c.tags ?? []).join(", "),
            csvDate(c.createdAt),
            csvDate(c.lastMessageAt),
          ])}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Etiquetas</th>
              <th className="px-4 py-3 text-right">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => {
              const stage = stageById.get(c.stageId);
              const style = stage ? stageStyle(stage.position) : null;
              const tags = c.tags ?? [];
              return (
                <tr key={c.id} className="border-b border-border/70 transition last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/businesses/${businessId}/crm?tab=chat&conv=${c.id}`} className="group flex items-center gap-3">
                      <span className="fl-mono flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-ink-muted">
                        {contactInitial(c.customerName, c.customerPhone).slice(0, 2)}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-ink group-hover:text-accent ${c.unreadCount > 0 ? "font-bold" : "font-semibold"}`}>
                          {contactLabel(c.customerName, c.customerPhone)}
                        </span>
                        {c.customerEmail && <span className="block truncate text-xs text-ink-faint">{c.customerEmail}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="fl-mono whitespace-nowrap px-4 py-2.5 text-xs text-ink-muted">{formatPhone(c.customerPhone)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {stage && style && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink">
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-muted">
                          {t}
                        </span>
                      ))}
                      {tags.length > 3 && <span className="text-[11px] text-ink-faint">+{tags.length - 3}</span>}
                      {tags.length === 0 && <span className="text-xs text-ink-faint">—</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-ink-muted">{formatTime(c.lastMessageAt)}</td>
                </tr>
              );
            })}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                  No hay contactos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
