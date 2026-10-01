"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlanTier } from "@prisma/client";
import { SubscriptionDatesEditor } from "./SubscriptionDatesEditor";
import { AddonGrantCell } from "./AddonGrantCell";
import { ResetPasswordButton } from "./ResetPasswordButton";

export type ClientRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  joinedAt: string;
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

type Status = "active" | "expiring" | "expired" | "unset";
const DAY_MS = 86_400_000;

const STATUS: Record<Status, { label: string; bg: string; fg: string; dot: string }> = {
  active: { label: "Activa", bg: "rgba(12,163,12,0.12)", fg: "var(--status-good)", dot: "#0ca30c" },
  expiring: { label: "Por vencer", bg: "rgba(250,178,25,0.16)", fg: "var(--status-warn)", dot: "#fab219" },
  expired: { label: "Vencida", bg: "rgba(208,59,59,0.12)", fg: "var(--status-bad)", dot: "#d03b3b" },
  unset: { label: "Sin fecha", bg: "rgba(138,138,134,0.14)", fg: "var(--ink-muted)", dot: "#8a8a86" },
};

const FILTERS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "Todos" },
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

function statusOf(endsAt: string | null, now: number): { status: Status; days: number | null } {
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

export function ClientsList({ rows, nowIso }: { rows: ClientRow[]; nowIso: string }) {
  const now = new Date(nowIso).getTime();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState<string | null>(null);

  const enriched = useMemo(() => rows.map((r) => ({ ...r, ...statusOf(r.endsAt, now) })), [rows, now]);
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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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

      {visible.length === 0 && <p className="fl-card p-5 text-sm text-ink-muted">No hay clientes con ese filtro.</p>}

      {visible.map((r) => {
        const s = STATUS[r.status];
        const usage = r.contactLimit ? Math.min(100, (r.contacts / r.contactLimit) * 100) : null;
        const isOpen = open === r.userId;
        return (
          <article key={r.userId} className="fl-card overflow-hidden">
            <div className="flex flex-wrap items-start gap-3 p-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent/15 text-sm font-bold text-accent">
                {initials(r.name) || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-ink">{r.name}</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                    {r.days !== null && (r.status === "expired" ? (r.days === 0 ? " hoy" : ` hace ${Math.abs(r.days)} d`) : ` · ${r.days} d`)}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-ink">
                    {r.planLabel} · US${r.priceUsd}/mes{r.customPrice ? "*" : ""}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-muted">
                  <a href={`mailto:${r.email}`} className="hover:text-ink hover:underline">{r.email}</a>
                  {r.phone && (
                    <a href={waLink(r.phone)} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                      WhatsApp {r.phone}
                    </a>
                  )}
                  {r.location && <span>{r.location}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.userId)}
                aria-expanded={isOpen}
                className="flex-none rounded-lg border border-border-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent"
              >
                {isOpen ? "Cerrar" : "Gestionar"}
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt className="text-xs text-ink-muted">Membresía</dt>
                <dd className="font-medium text-ink">{r.endsAt ? `Vence ${fmtDate(r.endsAt)}` : "Sin fecha"}</dd>
                {r.startedAt && <dd className="text-xs text-ink-muted">Desde {fmtDate(r.startedAt)}</dd>}
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Último pago</dt>
                <dd className="font-medium text-ink">{r.lastPayment ? fmtDate(r.lastPayment) : "Manual / sin registro"}</dd>
                {r.lastPayment && <dd className="text-xs text-ink-muted">Automático ({r.paymentProvider})</dd>}
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Clientes con IA este mes</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {r.contacts.toLocaleString("es-CO")} / {r.contactLimit?.toLocaleString("es-CO") ?? "∞"}
                </dd>
                {usage !== null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${usage >= 100 ? "bg-error" : usage >= 80 ? "bg-[#fab219]" : "bg-accent"}`}
                      style={{ width: `${Math.max(usage, 1)}%` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Líneas de WhatsApp</dt>
                <dd className="font-medium text-ink">
                  {r.lines.filter((l) => l.whatsappConnected).length} de {r.lines.length} conectada{r.lines.length === 1 ? "" : "s"}
                </dd>
                <dd className="text-xs text-ink-muted">Plan: hasta {r.lineLimit ?? "∞"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Última actividad</dt>
                <dd className="font-medium text-ink">{relative(r.lastActivity, now)}</dd>
                <dd className="text-xs text-ink-muted">
                  Equipo {r.team}/{r.teamLimit ?? "∞"} · {r.websites} página{r.websites === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Cliente desde</dt>
                <dd className="font-medium text-ink">{fmtDate(r.joinedAt)}</dd>
                {r.addons.length > 0 && <dd className="text-xs text-accent">{r.addons.length} paquete{r.addons.length === 1 ? "" : "s"} activo{r.addons.length === 1 ? "" : "s"}</dd>}
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-border bg-surface-2/50 px-4 py-2.5 text-sm">
              {r.lines.map((l) => (
                <Link key={l.businessId} href={`/dashboard/businesses/${l.businessId}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-ink hover:bg-surface hover:text-accent">
                  <span className={`h-2 w-2 rounded-full ${l.whatsappConnected ? "bg-[#0ca30c]" : "bg-[#8a8a86]"}`} title={l.whatsappConnected ? "WhatsApp conectado" : "WhatsApp sin conectar"} />
                  {l.name} →
                </Link>
              ))}
            </div>

            {isOpen && (
              <div className="grid gap-5 border-t border-border p-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Membresía</p>
                  <p className="text-xs text-ink-muted">Se renueva sola con cada pago. Cámbiala aquí solo para casos especiales.</p>
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
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Paquetes</p>
                  <AddonGrantCell
                    ownerUserId={r.userId}
                    active={r.addons.map((a) => ({ id: a.id, title: a.title, expiresAt: a.expiresAt ? fmtDate(a.expiresAt) : "" }))}
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Acceso</p>
                  <p className="text-xs text-ink-muted">Genera una contraseña nueva para entrar a probar su cuenta o enviársela.</p>
                  <ResetPasswordButton userId={r.userId} />
                  <Link href="/dashboard/rentabilidad" className="block text-xs font-semibold text-accent hover:underline">
                    Ver su rentabilidad →
                  </Link>
                </div>
              </div>
            )}
          </article>
        );
      })}
      {rows.some((r) => r.customPrice) && <p className="text-xs text-ink-muted">* Precio especial definido en Rentabilidad.</p>}
    </section>
  );
}
