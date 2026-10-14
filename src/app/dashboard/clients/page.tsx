import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientRows } from "@/lib/clientRows";
import { CreateClientForm } from "./CreateClientForm";
import { EmailCheckButton } from "./EmailCheckButton";
import { ClientsList } from "./ClientsList";

const DAY_MS = 86_400_000;

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const all = await getClientRows(session.user.id, now);
  if (!all) notFound();
  // Signed up but never registered a card: leads for the sales team, not
  // clients yet (no access, no revenue).
  const list = all.filter((r) => !r.pendingCard);
  const pending = all.filter((r) => r.pendingCard);
  // Negative (or -0.x) once the end has passed: expired, even if only by minutes.
  const daysLeft = (iso: string | null) => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - now.getTime();
    return diff <= 0 ? -1 : Math.ceil(diff / DAY_MS);
  };
  // Trials still running are counted apart: they haven't paid yet.
  const trials = list.filter((r) => r.billing === "trial" && (daysLeft(r.endsAt) ?? -1) >= 0);
  const members = list.filter((r) => !trials.includes(r));
  const summary = {
    pending: pending.length,
    trial: trials.length,
    active: members.filter((r) => (daysLeft(r.endsAt) ?? 1) > 7).length,
    expiring: members.filter((r) => {
      const d = daysLeft(r.endsAt);
      return d !== null && d >= 0 && d <= 7;
    }).length,
    expired: members.filter((r) => (daysLeft(r.endsAt) ?? 0) < 0).length,
    mrr: members.filter((r) => (daysLeft(r.endsAt) ?? 1) >= 0).reduce((s, r) => s + r.priceUsd, 0),
    trialMrr: trials.reduce((s, r) => s + r.priceUsd, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Quién te paga, hasta cuándo y cómo usa la plataforma. Las membresías se activan y renuevan solas con cada pago de Mercado Pago.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <EmailCheckButton />
          <CreateClientForm />
        </div>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6">
        {[
          { label: "Sin tarjeta", value: summary.pending.toLocaleString("es-CO"), hint: "Se registraron, falta cerrarlos", tone: summary.pending ? "text-accent" : "" },
          { label: "En prueba", value: summary.trial.toLocaleString("es-CO"), hint: "Prueba gratis, aún no pagan", tone: summary.trial ? "text-[var(--status-trial)]" : "" },
          { label: "Mes activo", value: summary.active.toLocaleString("es-CO"), hint: "Ya pagan, membresía al día", tone: "text-[var(--status-good)]" },
          { label: "Por vencer", value: summary.expiring.toLocaleString("es-CO"), hint: "En los próximos 7 días", tone: summary.expiring ? "text-[var(--status-warn)]" : "" },
          { label: "Vencidos", value: summary.expired.toLocaleString("es-CO"), hint: "Sin acceso al panel", tone: summary.expired ? "text-[var(--status-bad)]" : "" },
          {
            label: "Ingreso / mes",
            value: `US$${summary.mrr.toLocaleString("es-CO")}`,
            hint: summary.trialMrr ? `+US$${summary.trialMrr.toLocaleString("es-CO")} si pagan las pruebas` : "Clientes que pagan (aprox.)",
          },
        ].map((t) => (
          <div key={t.label} className="fl-card p-3 sm:p-4">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted sm:text-xs">{t.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${t.tone ?? "text-ink"}`}>{t.value}</p>
            <p className="hidden text-xs text-ink-muted sm:block">{t.hint}</p>
          </div>
        ))}
      </section>

      <ClientsList rows={all} nowIso={now.toISOString()} supportHost={process.env.APP_HOST ?? "agente.funnelslabs.app"} />
    </div>
  );
}
