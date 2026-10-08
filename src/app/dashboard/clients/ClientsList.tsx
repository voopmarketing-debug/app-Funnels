"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlanTier } from "@prisma/client";
import { SubscriptionDatesEditor } from "./SubscriptionDatesEditor";
import { AddonGrantCell } from "./AddonGrantCell";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { PendingCardStrip } from "./PendingCardStrip";

export type ClientRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  joinedAt: string;
  // Signed up on their own but never registered a card (see /activar).
  pendingCard: boolean;
  // When they last went to Mercado Pago from /activar without finishing.
  checkoutOpenedAt: string | null;
  // A Mercado Pago subscription is linked to the account.
  cardOnFile: boolean;
  planTier: PlanTier;
  planLabel: string;
  priceUsd: number;
  customPrice: boolean;
  startedAt: string | null;
  endsAt: string | null;
  contacts: number;
  contactLimit: number | null;
  lineLimit: number | null;
  teamLimit: number | null;
  team: number;
  websites: number;
  lastActivity: string | null;
  lastPayment: string | null;
  paymentProvider: string;
  lines: { businessId: string; name: string; whatsappConnected: boolean; startedAt: string | null; endsAt: string | null }[];
  addons: { id: string; title: string; expiresAt: string; quantity: number; kind: string }[];
};

type Status = "nocard" | "active" | "expiring" | "expired" | "unset";
const DAY_MS = 86_400_000;

const STATUS: Record<Status, { label: string; bg: string; fg: string; dot: string }> = {
  nocard: { label: "Sin tarjeta", bg: "rgba(99,102,241,0.14)", fg: "var(--ink)", dot: "#6366f1" },
  active: { label: "Activa", bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)", dot: "#0ca30c" },
  expiring: { label: "Por vencer", bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)", dot: "#fab219" },
  expired: { label: "Vencida", bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)", dot: "#d03b3b" },
  unset: { label: "Sin fecha", bg: "rgba(138,138,134,0.14)", fg: "var(--ink-muted)", dot: "#8a8a86" },
};

const FILTERS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "nocard", label: "Sin tarjeta" },
  { key: "active", label: "Activos" },
  { key: "expiring", label: "Por vencer" },
  { key: "expired", label: "Vencidos" },
  { key: "unset", label: "Sin fecha" },
];

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso));
}

function relative(iso: string | null, now: number): string {
  if (!iso) return "Sin actividad";
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  return `Hace ${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? "mes" : "meses"}`;
}

function statusOf(endsAt: string | null, now: number): { status: Exclude<Status, "nocard">; days: number | null } {
  if (!endsAt) return { status: "unset", days: null };
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return { status: "expired", days: -Math.floor(-diff / DAY_MS) };
  const days = Math.ceil(diff / DAY_MS);
  if (days <= 7) return { status: "expiring", days };
  return { status: "active", days };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `57${digits}` : digits}`;
}

export function ClientsList({ rows, nowIso, supportHost }: { rows: ClientRow[]; nowIso: string; supportHost: string }) {
  const now = new Date(nowIso).getTime();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState<string | null>(null);

  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, ...(r.pendingCard ? { status: "nocard" as Status, days: null } : statusOf(r.endsAt, now)) })),
    [rows, now],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enriched.length };
    for (const r of enriched) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [enriched]);

  const q = query.trim().toLowerCase();
  const visible = enriched.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (!q || [r.name, r.email, r.phone ?? "", ...r.lines.map((l) => l.name)].some((v) => v.toLowerCase().includes(q))),
  );

  // Leads to close first, then whoever needs attention, then the rest.
  const ORDER: Record<Status, number> = { nocard: 0, expired: 1, expiring: 2, unset: 3, active: 4 };
  const sorted = [...visible].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo, teléfono o negocio"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent sm:max-w-sm"
        />
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.label} <span className="opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 && <p className="fl-card p-5 text-sm text-ink-muted">No hay clientes con ese filtro.</p>}

      <div className="fl-card divide-y divide-border overflow-hidden p-0">
        {sorted.map((r) => {
          const s = STATUS[r.status];
          const usage = r.contactLimit ? Math.min(100, (r.contacts / r.contactLimit) * 100) : null;
          const isOpen = open === r.userId;
          const connected = r.lines.filter((l) => l.whatsappConnected).length;
          const statusDetail =
            r.status === "nocard"
              ? `Se registró ${relative(r.joinedAt, now).toLowerCase()}`
              : r.status === "expired"
                ? `Venció ${r.days === 0 ? "hoy" : `hace ${Math.abs(r.days ?? 0)} d`}`
                : r.status === "unset"
                  ? "Sin fecha de vencimiento"
                  : `Vence ${fmtDate(r.endsAt!)} · ${r.days} d`;
          return (
            <article key={r.userId} className={isOpen ? "bg-surface-2/40" : ""}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.userId)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition hover:bg-surface-2/60 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent/15 text-sm font-bold text-accent">
                  {initials(r.name) || "?"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{r.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {r.lines.map((l) => l.name).join(" · ") || r.email}
                  </span>
                </span>
                <span className="col-span-3 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:col-span-1 md:row-start-auto md:block">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                  <span className="text-xs text-ink-muted md:mt-0.5 md:block">{statusDetail}</span>
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block text-xs text-ink-muted">IA este mes</span>
                  <span className="block text-sm font-semibold tabular-nums text-ink">
                    {r.contacts.toLocaleString("es-CO")} <span className="font-normal text-ink-muted">/ {r.contactLimit?.toLocaleString("es-CO") ?? "∞"}</span>
                  </span>
                  {usage !== null && (
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
                      <span
                        className={`block h-full rounded-full ${usage >= 100 ? "bg-error" : usage >= 80 ? "bg-[#fab219]" : "bg-accent"}`}
                        style={{ width: `${Math.max(usage, 2)}%` }}
                      />
                    </span>
                  )}
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block text-xs text-ink-muted">{r.planLabel}</span>
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${connected ? "text-ink" : "text-ink-muted"}`}>
                    <span className={`h-2 w-2 flex-none rounded-full ${connected ? "bg-[#0ca30c]" : "bg-[#8a8a86]"}`} />
                    {connected ? "WhatsApp conectado" : "Sin conectar"}
                  </span>
                </span>
                <span className="col-start-3 row-start-1 flex items-center justify-end gap-1 text-sm font-semibold text-ink-muted sm:min-w-[72px] md:col-start-auto md:row-start-auto">
                  <span className="hidden sm:inline">{isOpen ? "Cerrar" : "Ver"}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {r.pendingCard && (
                <PendingCardStrip
                  userId={r.userId}
                  name={r.name}
                  business={r.lines[0]?.name ?? r.name}
                  phone={r.phone}
                  openedCheckout={!!r.checkoutOpenedAt}
                  activationUrl={`https://${supportHost}/activar`}
                />
              )}

              {isOpen && (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`mailto:${r.email}`} className="text-ink hover:text-accent hover:underline">
                      ✉️ {r.email}
                    </a>
                    {r.phone && (
                      <a href={waLink(r.phone)} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent hover:underline">
                        💬 WhatsApp {r.phone}
                      </a>
                    )}
                    {r.location && <span className="text-ink-muted">📍 {r.location}</span>}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      { k: "Plan", v: `${r.planLabel} · US$${r.priceUsd}/mes${r.customPrice ? "*" : ""}` },
                      {
                        k: "Membresía",
                        v: r.pendingCard ? "Sin activar" : r.endsAt ? `Hasta ${fmtDate(r.endsAt)}` : "Sin fecha",
                        sub: r.startedAt ? `Desde ${fmtDate(r.startedAt)}` : undefined,
                      },
                      {
                        k: "Último pago",
                        v: r.lastPayment ? fmtDate(r.lastPayment) : r.pendingCard ? "Aún no" : "Manual",
                        sub: r.lastPayment ? `Automático · ${r.paymentProvider}` : r.cardOnFile ? "Tarjeta registrada" : undefined,
                      },
                      { k: "Líneas de WhatsApp", v: `${connected} de ${r.lines.length} conectada${r.lines.length === 1 ? "" : "s"}`, sub: `Plan: hasta ${r.lineLimit ?? "∞"}` },
                      { k: "Última actividad", v: relative(r.lastActivity, now), sub: `Equipo ${r.team}/${r.teamLimit ?? "∞"} · ${r.websites} página${r.websites === 1 ? "" : "s"}` },
                      { k: "Cliente desde", v: fmtDate(r.joinedAt), sub: r.addons.length ? `${r.addons.length} paquete${r.addons.length === 1 ? "" : "s"} activo${r.addons.length === 1 ? "" : "s"}` : undefined },
                    ].map((d) => (
                      <div key={d.k} className="rounded-lg border border-border bg-surface px-3 py-2">
                        <dt className="text-xs text-ink-muted">{d.k}</dt>
                        <dd className="text-sm font-semibold text-ink">{d.v}</dd>
                        {d.sub && <dd className="text-xs text-ink-muted">{d.sub}</dd>}
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {r.lines.map((l) => (
                      <Link
                        key={l.businessId}
                        href={`/dashboard/businesses/${l.businessId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
                      >
                        <span className={`h-2 w-2 rounded-full ${l.whatsappConnected ? "bg-[#0ca30c]" : "bg-[#8a8a86]"}`} />
                        Abrir {l.name} →
                      </Link>
                    ))}
                    <Link href="/dashboard/rentabilidad" className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-accent hover:underline">
                      Ver su rentabilidad →
                    </Link>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold text-ink">Membresía</p>
                      <p className="text-xs text-ink-muted">Se renueva sola con cada pago. Cámbiala aquí solo en casos especiales.</p>
                      {r.lines.map((l) => (
                        <div key={l.businessId} className="space-y-1">
                          {r.lines.length > 1 && <p className="text-xs font-medium text-ink">{l.name}</p>}
                          <SubscriptionDatesEditor
                            businessId={l.businessId}
                            startedAt={l.startedAt ? new Date(l.startedAt) : null}
                            endsAt={l.endsAt ? new Date(l.endsAt) : null}
                            status={statusOf(l.endsAt, now).status}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold text-ink">Paquetes extra</p>
                      <AddonGrantCell
                        ownerUserId={r.userId}
                        active={r.addons.map((a) => ({ id: a.id, title: a.title, expiresAt: a.expiresAt ? fmtDate(a.expiresAt) : "" }))}
                      />
                    </div>
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold text-ink">Acceso</p>
                      <p className="text-xs text-ink-muted">Genera una contraseña nueva para entrar a revisar su cuenta o enviársela.</p>
                      <ResetPasswordButton userId={r.userId} />
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {rows.some((r) => r.customPrice) && <p className="text-xs text-ink-muted">* Precio especial definido en Rentabilidad.</p>}
    </section>
  );
}
