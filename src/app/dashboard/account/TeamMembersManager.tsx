"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteTeamMember, removeTeamMember } from "@/lib/actions";

export type TeamMember = { userId: string; name: string | null; email: string };

export type TeamBusiness = {
  businessId: string;
  businessName: string;
  limit: number | null;
  members: TeamMember[];
};

export function TeamMembersManager({ businesses }: { businesses: TeamBusiness[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(businesses[0]?.businessId ?? "");

  if (businesses.length === 0) return null;

  const selected = businesses.find((b) => b.businessId === selectedId) ?? businesses[0];
  const atLimit = selected.limit !== null && selected.members.length >= selected.limit;

  function handleInvite(formData: FormData) {
    setError(null);
    setNotice(null);
    startSubmitting(async () => {
      try {
        const res = await inviteTeamMember(selected.businessId, formData);
        setNotice(
          res.status === "created"
            ? `Cuenta creada para ${res.email} — ya puede entrar con el correo y la contraseña que pusiste.`
            : `${res.email} ya tenía cuenta — se agregó a "${selected.businessName}", entra con su contraseña de siempre.`,
        );
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear esta cuenta");
      }
    });
  }

  function handleRemove(userId: string, label: string) {
    if (!confirm(`¿Quitar a "${label}" del equipo de "${selected.businessName}"? Ya no podrá entrar a ese negocio.`))
      return;
    setRemovingId(userId);
    startSubmitting(async () => {
      await removeTeamMember(selected.businessId, userId);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <div className="fl-card max-w-sm space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-ink">Equipo de ventas</h2>
        <p className="text-xs text-ink-muted">
          Crea un usuario y contraseña para cada vendedor, para que puedan estar conectados al mismo tiempo, cada
          quien trabajando su propio embudo. Su acceso es limitado a propósito: pueden usar el CRM y las
          conversaciones, pero no ven ni cambian las credenciales de WhatsApp, la configuración del agente de IA,
          el plan, ni pueden borrar el negocio o el equipo.
        </p>
      </div>

      {businesses.length > 1 && (
        <div className="space-y-1">
          <label htmlFor="teamBusiness" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Negocio
          </label>
          <select
            id="teamBusiness"
            value={selected.businessId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setError(null);
              setNotice(null);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {businesses.map((b) => (
              <option key={b.businessId} value={b.businessId}>
                {b.businessName}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
        {selected.businessName} — equipo ({selected.members.length}
        {selected.limit !== null ? `/${selected.limit}` : ""})
      </p>

      {selected.members.length > 0 && (
        <ul className="space-y-2">
          {selected.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{member.name ?? member.email}</p>
                <p className="fl-mono truncate text-[11px] text-ink-faint">{member.email}</p>
              </div>
              <button
                type="button"
                disabled={removingId === member.userId}
                onClick={() => handleRemove(member.userId, member.name ?? member.email)}
                className="flex-none rounded border border-error/40 px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:opacity-30"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="rounded-md border border-dashed border-border bg-background px-3 py-2.5 text-xs text-ink-muted">
          Llegaste al máximo de {selected.limit} personas de equipo de tu plan actual. Quita a alguien de la lista
          de arriba para crear otra cuenta, o actualiza de plan para tener más cupos.
        </p>
      ) : (
        <form ref={formRef} action={handleInvite} className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1">
            <label htmlFor="teamName" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Nombre
            </label>
            <input
              id="teamName"
              type="text"
              name="name"
              required
              placeholder="Ej: Juan Pérez"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="teamEmail" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Correo (usuario)
            </label>
            <input
              id="teamEmail"
              type="email"
              name="email"
              required
              placeholder="correo@ejemplo.com"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="teamPassword" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Contraseña
            </label>
            <input
              id="teamPassword"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <p className="text-xs text-ink-muted">
              Tú eliges la contraseña — solo se usa si el correo no tiene cuenta todavía. Compártesela al vendedor
              para que entre de una vez.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isSubmitting ? "Creando..." : "+ Crear usuario"}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
      {notice && <p className="text-xs text-accent">{notice}</p>}
    </div>
  );
}
