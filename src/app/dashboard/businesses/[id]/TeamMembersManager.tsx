"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteTeamMember, removeTeamMember, type InviteTeamMemberResult } from "@/lib/actions";

// A fourth color on this page (purple = agent instructions, green =
// WhatsApp, blue = agent media) so all four collapsible cards stay visually
// distinct at a glance.
const TONE_VAR = "--glow-amber";

export type TeamMember = { userId: string; name: string | null; email: string };

export function TeamMembersManager({ businessId, members }: { businessId: string; members: TeamMember[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isInviting, startInviting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteTeamMemberResult | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleInvite(formData: FormData) {
    setError(null);
    setResult(null);
    startInviting(async () => {
      try {
        const res = await inviteTeamMember(businessId, formData);
        setResult(res);
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo invitar a esta persona");
      }
    });
  }

  function handleRemove(userId: string, label: string) {
    if (!confirm(`¿Quitar a "${label}" del equipo? Ya no podrá entrar a este negocio.`)) return;
    setRemovingId(userId);
    startInviting(async () => {
      await removeTeamMember(businessId, userId);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <details
      className="group self-start overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `rgba(var(${TONE_VAR}), 0.28)`,
        background: `radial-gradient(120% 140% at 100% 0%, rgba(var(${TONE_VAR}), 0.16), transparent 60%), var(--surface)`,
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
          style={{ backgroundColor: `rgba(var(${TONE_VAR}), 0.16)`, color: `rgba(var(${TONE_VAR}), 1)` }}
        >
          <TeamIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="fl-mono block text-xs tracking-wide text-ink uppercase">
            Equipo ({members.length})
          </span>
          <span className="mt-0.5 block text-xs normal-case text-ink-faint group-open:hidden">
            Haz clic para invitar vendedores con su propio usuario.
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 flex-none transition-transform group-open:rotate-180"
          style={{ color: `rgba(var(${TONE_VAR}), 1)` }}
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <p className="mt-4 text-sm text-ink">
        Invita a cada vendedor con su propio correo y contraseña para que puedan estar conectados al mismo tiempo,
        cada quien trabajando su propio embudo (ver CRM). Su acceso es limitado a propósito: pueden usar el CRM y
        las conversaciones, pero no ven ni cambian las credenciales de WhatsApp, la configuración del agente de IA,
        el plan, ni pueden borrar el negocio o el equipo.
      </p>

      {members.length > 0 && (
        <ul className="mt-4 space-y-2">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
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

      <form ref={formRef} action={handleInvite} className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="name"
            required
            placeholder="Nombre, ej: Juan Pérez"
            disabled={isInviting}
            className="w-full flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="correo@ejemplo.com"
            disabled={isInviting}
            className="w-full flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={isInviting}
            className="flex-none rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isInviting ? "Invitando..." : "+ Invitar"}
          </button>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </form>

      {result && result.status === "created" && (
        <div className="mt-3 rounded-md border-2 border-accent/50 bg-background p-3">
          <p className="text-sm font-medium text-ink">Cuenta creada para {result.email}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Cópiale esta contraseña ahora — no se puede volver a ver después. Puede cambiarla luego desde "Mi
            perfil".
          </p>
          <p className="fl-mono mt-2 rounded border border-border bg-surface px-3 py-2 text-sm text-accent select-all">
            {result.password}
          </p>
        </div>
      )}
      {result && result.status === "existing_user_added" && (
        <p className="mt-3 text-xs text-ink-muted">
          {result.email} ya tenía una cuenta — solo se agregó al equipo de este negocio, entra con su contraseña de
          siempre.
        </p>
      )}
    </details>
  );
}

function TeamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.3" stroke="currentColor" strokeWidth="2" />
      <path d="M15 13.5c2.3.3 4 2.3 4.2 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
