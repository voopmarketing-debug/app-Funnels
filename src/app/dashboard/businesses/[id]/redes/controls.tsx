"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { disconnectSocial, refreshSocialData, selectSocialAccounts } from "@/lib/socialActions";
import type { AdTotals } from "@/lib/metaSocial";
import { LineChart, compact, type ChartSeries } from "./LineChart";
import { moneyFormatter } from "./format";

export function RefreshButton({ businessId, updatedLabel }: { businessId: string; updatedLabel: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-faint">{note ?? updatedLabel}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await refreshSocialData(businessId);
            setNote(res.ok ? null : "Se acaba de actualizar; espera un par de minutos");
          })
        }
        className="fl-raised rounded-xl px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Actualizando…" : "↻ Actualizar"}
      </button>
    </div>
  );
}

export function DisconnectButton({ businessId }: { businessId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("¿Desconectar Facebook, Instagram y Meta Ads de este negocio? Puedes volver a conectarlos cuando quieras.")) {
          start(() => disconnectSocial(businessId));
        }
      }}
      className="text-xs font-semibold text-ink-muted underline hover:text-error disabled:opacity-60"
    >
      {pending ? "Desconectando…" : "Desconectar"}
    </button>
  );
}

export function AccountPicker({
  businessId,
  pages,
  adAccounts,
  currentPageId,
  currentAdAccountId,
}: {
  businessId: string;
  pages: { id: string; name: string; igUsername: string | null }[];
  adAccounts: { id: string; name: string; currency: string; active: boolean; spent?: number }[];
  currentPageId: string | null;
  currentAdAccountId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pageId, setPageId] = useState(currentPageId ?? pages[0]?.id ?? "");
  const [adId, setAdId] = useState(currentAdAccountId ?? adAccounts.find((a) => a.active)?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="fl-card space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await selectSocialAccounts(businessId, pageId || null, adId || null);
          if (res.ok) router.push(pathname);
          else setError(res.error);
        });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Cambiar las cuentas que mides</h2>
          <p className="text-sm text-ink-muted">Elige la página de Facebook (con su Instagram) y la cuenta de anuncios de este negocio.</p>
        </div>
        {(currentPageId || currentAdAccountId) && (
          <button type="button" onClick={() => router.push(pathname)} className="text-sm font-semibold text-ink-muted underline hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5" htmlFor="social-page">
          <span className="text-sm font-semibold">Página de Facebook (y su Instagram)</span>
          <select id="social-page" value={pageId} onChange={(e) => setPageId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">Ninguna</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.igUsername ? ` · @${p.igUsername}` : " · sin Instagram"}
              </option>
            ))}
          </select>
          {pages.length === 0 && <span className="block text-xs text-ink-muted">No encontramos páginas. Revisa que tu usuario sea administrador de la página.</span>}
        </label>
        <label className="block space-y-1.5" htmlFor="social-ads">
          <span className="text-sm font-semibold">Cuenta publicitaria</span>
          <select id="social-ads" value={adId} onChange={(e) => setAdId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">Ninguna</option>
            {adAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
                {a.active ? "" : " (inactiva)"}
              </option>
            ))}
          </select>
          {adAccounts.length === 0 && <span className="block text-xs text-ink-muted">No encontramos cuentas publicitarias en tu Facebook.</span>}
        </label>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar y ver métricas"}
      </button>
    </form>
  );
}

type NetworkSeries = { key: "facebook" | "instagram"; values: Record<string, number | null> };
const NETWORK_META = {
  facebook: { label: "Facebook", color: "var(--series-fb)" },
  instagram: { label: "Instagram", color: "var(--series-ig)" },
};

export function NetworkChart({ days, series, label, emptyText }: { days: string[]; series: (NetworkSeries & { label?: string })[]; label: string; emptyText?: string }) {
  const chart: ChartSeries[] = series.map((s) => ({ key: s.key, label: s.label ?? NETWORK_META[s.key].label, color: NETWORK_META[s.key].color, values: s.values }));
  return <LineChart days={days} series={chart} label={label} emptyText={emptyText} format={(n) => Math.round(n).toLocaleString("es-CO")} />;
}

const AD_METRICS = [
  { key: "spend", label: "Gasto" },
  { key: "impressions", label: "Impresiones" },
  { key: "clicks", label: "Clics" },
  { key: "cpm", label: "CPM" },
  { key: "cpc", label: "CPC" },
] as const;
type AdMetric = (typeof AD_METRICS)[number]["key"];

export function AdsDailyChart({ days, daily, currency }: { days: string[]; daily: Record<string, AdTotals>; currency: string }) {
  const [metric, setMetric] = useState<AdMetric>("spend");
  const money = moneyFormatter(currency);
  const isMoney = metric === "spend" || metric === "cpm" || metric === "cpc";
  const values: Record<string, number | null> = {};
  for (const day of days) {
    const d = daily[day];
    if (!d) {
      values[day] = metric === "cpm" || metric === "cpc" ? null : 0;
      continue;
    }
    values[day] =
      metric === "cpm" ? (d.impressions > 0 ? (d.spend / d.impressions) * 1000 : null) : metric === "cpc" ? (d.clicks > 0 ? d.spend / d.clicks : null) : d[metric];
  }
  const label = AD_METRICS.find((m) => m.key === metric)!.label;
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Métrica" className="fl-seg">
        {AD_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.key === metric}
            onClick={() => setMetric(m.key)}
            className="fl-seg-item"
          >
            {m.label}
          </button>
        ))}
      </div>
      <LineChart
        days={days}
        label={`${label} por día`}
        series={[{ key: metric, label, color: "var(--series-fb)", values }]}
        format={(n) => (isMoney ? money(n) : compact(n))}
        emptyText="Sin gasto en este período"
      />
    </div>
  );
}
