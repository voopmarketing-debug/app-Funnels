import Link from "next/link";
import { stageStyle } from "@/lib/crmStages";
import { DownloadCsvButton } from "@/components/DownloadCsvButton";
import type { CrmStage, CrmConversation } from "./CrmBoard";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

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

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DownloadCsvButton
          filename="contactos"
          headers={["Nombre", "Teléfono", "Etapa", "Última actividad"]}
          rows={conversations.map((c) => [
            c.customerName ?? "",
            c.customerPhone,
            stageById.get(c.stageId)?.name ?? "",
            formatDate(c.lastMessageAt),
          ])}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Teléfono</th>
            <th className="px-4 py-3 font-medium">Etapa</th>
            <th className="px-4 py-3 font-medium">Última actividad</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => {
            const stage = stageById.get(c.stageId);
            const style = stage ? stageStyle(stage.position) : null;
            return (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/businesses/${businessId}/conversations/${c.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {c.customerName ?? c.customerPhone}
                  </Link>
                </td>
                <td className="fl-mono px-4 py-3 text-xs text-ink-muted">{c.customerPhone}</td>
                <td className="px-4 py-3">
                  {stage && style && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      <span className="text-ink-muted">{stage.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-muted">{formatDate(c.lastMessageAt)}</td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}
