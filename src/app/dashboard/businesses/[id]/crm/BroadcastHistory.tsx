type BroadcastRow = {
  id: string;
  message: string;
  stageName: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  delivered: number;
  read: number;
  failedAfterSend: number;
  ctaUrl: string | null;
  clickCount: number;
  createdAt: Date;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="fl-mono text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`text-lg font-bold ${tone === "bad" ? "text-error" : tone === "good" ? "text-accent" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

// A read receipt (or delivery) never arrives for every single accepted send —
// some contacts have read receipts turned off in WhatsApp, so 100% is not a
// realistic bar. Shown as a plain count, not a percentage, to avoid implying
// a target that Meta itself can't guarantee.
export function BroadcastHistory({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  if (broadcasts.length === 0) {
    return (
      <div className="fl-card p-6 text-center text-sm text-ink-muted">
        Todavía no has enviado ninguna difusión — usa el botón &quot;📢 Difusión&quot; de arriba para mandar la primera.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {broadcasts.map((b) => (
        <div key={b.id} className="fl-card space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{b.message}</p>
              <p className="fl-mono mt-0.5 text-[11px] text-ink-faint">
                {formatDate(b.createdAt)} · {b.stageName ?? "Todo el pipeline"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Destinatarios" value={b.totalRecipients} />
            <Metric label="Enviados" value={b.sentCount} />
            <Metric label="No enviados" value={b.failedCount} tone={b.failedCount > 0 ? "bad" : undefined} />
            <Metric label="Entregados" value={b.delivered} />
            <Metric label="Leídos" value={b.read} tone="good" />
            {b.ctaUrl ? (
              <Metric label="Clics al link" value={b.clickCount} tone="good" />
            ) : (
              <Metric label="Clics al link" value="—" />
            )}
          </div>

          {b.failedAfterSend > 0 && (
            <p className="text-[11px] text-error">
              {b.failedAfterSend} {b.failedAfterSend === 1 ? "mensaje falló" : "mensajes fallaron"} después de
              aceptarse (número inválido, WhatsApp desinstalado, etc.) — no cuenta como &quot;no enviado&quot;
              porque Meta sí lo intentó entregar.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
