"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adjustStock, setLowStockAt, setTrackStock } from "@/lib/productActions";

export type InventoryRow = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  active: boolean;
  trackStock: boolean;
  stock: number;
  lowStockAt: number;
  sold30: number;
  daysLeft: number | null;
};

type Level = "out" | "low" | "ok";

function levelOf(r: InventoryRow): Level {
  if (r.stock <= 0) return "out";
  if (r.stock <= r.lowStockAt) return "low";
  return "ok";
}

const LEVEL_ORDER: Record<Level, number> = { out: 0, low: 1, ok: 2 };

const LEVEL_STYLE: Record<Level, { pill: string; label: string; number: string }> = {
  out: { pill: "bg-error/15 text-error", label: "Agotado", number: "text-error" },
  low: { pill: "bg-[var(--status-warn)]/20 text-[var(--status-warn)]", label: "Por agotarse", number: "text-[var(--status-warn)]" },
  ok: { pill: "bg-[var(--status-good)]/15 text-[var(--status-good)]", label: "Disponible", number: "text-ink" },
};

function digits(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 7);
}

function Thumb({ row }: { row: InventoryRow }) {
  return row.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted product photo
    <img src={row.imageUrl} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
  ) : (
    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-surface-2 text-lg font-bold text-ink-faint">
      {row.name.slice(0, 1)}
    </span>
  );
}

/** One tracked product: units, pace, and the add / adjust / alert controls. */
function StockRow({ businessId, row }: { businessId: string; row: InventoryRow }) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "set" | null>(null);
  const [value, setValue] = useState("");
  const [alertAt, setAlertAt] = useState(String(row.lowStockAt));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const level = levelOf(row);
  const style = LEVEL_STYLE[level];

  function save() {
    if (!mode || value === "") return;
    setError(null);
    startTransition(async () => {
      const res = await adjustStock(businessId, row.id, mode, Number(value));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMode(null);
      setValue("");
      router.refresh();
    });
  }

  function saveAlert() {
    if (alertAt === "" || Number(alertAt) === row.lowStockAt) return;
    startTransition(async () => {
      const res = await setLowStockAt(businessId, row.id, Number(alertAt));
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function stopTracking() {
    if (!confirm(`¿Dejar de controlar el inventario de "${row.name}"? Volverá a mostrarse siempre como disponible.`)) return;
    startTransition(async () => {
      await setTrackStock(businessId, row.id, false);
      router.refresh();
    });
  }

  return (
    <li className={`fl-card space-y-3 p-4 ${isPending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <Thumb row={row} />
          <div className="min-w-0">
            {row.category && <p className="text-[11px] uppercase tracking-wide text-ink-faint">{row.category}</p>}
            <p className="truncate font-semibold text-ink">{row.name}</p>
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.pill}`}>{style.label}</span>
            {!row.active && <span className="ml-1 text-[11px] text-ink-faint">· oculto en tu web</span>}
          </div>
        </div>

        <dl className="grid flex-none grid-cols-3 gap-4 text-center sm:gap-6">
          <div>
            <dt className="text-[11px] text-ink-muted">Disponibles</dt>
            <dd className={`fl-mono text-2xl font-bold tabular-nums ${style.number}`}>{row.stock.toLocaleString("es-CO")}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">Vendidos 30 días</dt>
            <dd className="fl-mono text-2xl font-bold tabular-nums text-ink">{row.sold30.toLocaleString("es-CO")}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">Se acaba en</dt>
            <dd className="fl-mono text-2xl font-bold tabular-nums text-ink" title="Al ritmo de ventas de los últimos 30 días">
              {row.stock <= 0 ? "—" : row.daysLeft === null ? "—" : `~${row.daysLeft} d`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
        {mode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="text-xs text-ink-muted" htmlFor={`stock-${row.id}`}>
              {mode === "add" ? "Unidades que llegaron" : "Unidades que tienes ahora"}
            </label>
            <input
              id={`stock-${row.id}`}
              autoFocus
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(digits(e.target.value))}
              placeholder="0"
              className="fl-mono h-9 w-24 rounded-md border border-border bg-background px-2 text-base tabular-nums text-ink outline-none focus:border-accent md:text-sm"
            />
            <button
              type="submit"
              disabled={isPending || value === ""}
              className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              Guardar
            </button>
            <button type="button" onClick={() => setMode(null)} className="h-9 px-2 text-sm text-ink-muted hover:text-ink">
              Cancelar
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode("add")}
              className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              + Llegó mercancía
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("set");
                setValue(String(row.stock));
              }}
              className="h-9 rounded-md border border-border-strong px-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
            >
              Ajustar
            </button>
          </>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted">
          Avísame cuando queden
          <input
            inputMode="numeric"
            value={alertAt}
            onChange={(e) => setAlertAt(digits(e.target.value))}
            onBlur={saveAlert}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label={`Avisar cuando queden pocas unidades de ${row.name}`}
            className="fl-mono h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums text-ink outline-none focus:border-accent"
          />
        </label>
        <button type="button" onClick={stopTracking} className="text-xs text-ink-faint underline hover:text-error">
          No controlar
        </button>
      </div>
      {error && <p className="text-sm text-error">⚠ {error}</p>}
    </li>
  );
}

/** Products not tracking stock yet: one click (plus their current units) turns it on. */
function UntrackedRow({ businessId, row }: { businessId: string; row: InventoryRow }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function start() {
    if (value === "") return;
    setError(null);
    startTransition(async () => {
      const res = await adjustStock(businessId, row.id, "set", Number(value));
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <Thumb row={row} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium text-ink">{row.name}</p>
        {row.sold30 > 0 && <p className="text-xs text-ink-faint">{row.sold30} vendidos en 30 días</p>}
      </div>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="flex items-center gap-2"
        >
          <input
            autoFocus
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(digits(e.target.value))}
            placeholder="Unidades"
            aria-label={`Unidades disponibles de ${row.name}`}
            className="fl-mono h-9 w-28 rounded-md border border-border bg-background px-2 text-base tabular-nums text-ink outline-none focus:border-accent md:text-sm"
          />
          <button
            type="submit"
            disabled={isPending || value === ""}
            className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            Activar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-md border border-border-strong px-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          📦 Controlar inventario
        </button>
      )}
      {error && <p className="w-full text-sm text-error">⚠ {error}</p>}
    </li>
  );
}

export function InventoryList({ businessId, rows }: { businessId: string; rows: InventoryRow[] }) {
  const tracked = rows.filter((r) => r.trackStock).sort((a, b) => LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)]);
  const untracked = rows.filter((r) => !r.trackStock);

  if (rows.length === 0) {
    return (
      <div className="fl-card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-4xl" aria-hidden="true">
          📦
        </p>
        <p className="text-base font-semibold">Primero agrega tus productos</p>
        <p className="max-w-md text-sm text-ink-muted">El inventario se lleva por producto de tu catálogo.</p>
        <Link href={`/dashboard/businesses/${businessId}/productos`} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
          Ir a Productos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tracked.length > 0 ? (
        <ul className="space-y-3">
          {tracked.map((r) => (
            <StockRow key={r.id} businessId={businessId} row={r} />
          ))}
        </ul>
      ) : (
        <p className="fl-card p-4 text-sm text-ink-muted">
          Todavía ningún producto controla inventario. Activa los que se agotan (los servicios normalmente no lo necesitan).
        </p>
      )}

      {untracked.length > 0 && (
        <section className="fl-card p-4">
          <h2 className="text-sm font-semibold text-ink">Sin control de inventario ({untracked.length})</h2>
          <p className="text-xs text-ink-muted">Siempre aparecen como disponibles. Activa el control escribiendo cuántas unidades tienes hoy.</p>
          <ul className="mt-2 divide-y divide-border">
            {untracked.map((r) => (
              <UntrackedRow key={r.id} businessId={businessId} row={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
