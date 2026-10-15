"use client";

import { useActionState, useState, useTransition } from "react";
import { FacebookConnect } from "./FacebookConnect";
import { discoverWhatsAppNumbers, updateWabaCredentials, type DiscoverNumbersResult } from "@/lib/actions";

// WhatsApp's own brand green — deliberately not one of the shared KPI
// tones (accent/secondary/amber/blue), so this card reads as "WhatsApp"
// at a glance next to the purple "Instrucciones del agente" card it
// otherwise matches structurally.
const WHATSAPP_GREEN = "37, 211, 102";

type SaveState = { saved: boolean; error: string | null; connectedNumber: string | null };

type Found = Extract<DiscoverNumbersResult, { ok: true }>;

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink outline-none focus:border-accent";

function expiryLabel(iso: string | null): { text: string; good: boolean } {
  if (!iso) return { text: "Token permanente: no vence", good: true };
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours > 24 * 30) return { text: `Vence en ${Math.floor(hours / 24)} días`, good: true };
  const when = hours <= 48 ? `${Math.max(hours, 0)} horas` : `${Math.floor(hours / 24)} días`;
  return { text: `Este token vence en ${when}. Cuando venza, el agente deja de responder; mejor usa uno permanente`, good: false };
}

export function WabaCredentialsForm({
  businessId,
  wabaPhoneNumberId,
  wabaId,
  signup,
}: {
  businessId: string;
  wabaPhoneNumberId: string;
  wabaId: string;
  /** Present only when the server has the Meta app and the Embedded Signup configuration. */
  signup?: { appId: string; configId: string } | null;
}) {
  const connected = Boolean(wabaPhoneNumberId);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [phoneId, setPhoneId] = useState(wabaPhoneNumberId);
  const [accountId, setAccountId] = useState(wabaId);
  const [found, setFound] = useState<Found | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    async (_prevState, formData) => {
      if (!String(formData.get("wabaPhoneNumberId") ?? "").trim()) {
        return { saved: false, connectedNumber: null, error: "Elige tu número de la lista (o escribe el Phone Number ID en la opción manual)." };
      }
      try {
        const result = await updateWabaCredentials(businessId, formData);
        if (!result.verified) {
          return {
            saved: false,
            connectedNumber: null,
            error: `Guardamos los datos, pero Meta los rechazó al verificarlos: ${result.verifyError}`,
          };
        }
        return { saved: true, error: null, connectedNumber: result.displayPhoneNumber };
      } catch (err) {
        return {
          saved: false,
          connectedNumber: null,
          error: err instanceof Error ? err.message : "No se pudo guardar, intenta de nuevo",
        };
      }
    },
    { saved: false, error: null, connectedNumber: null },
  );

  function search() {
    setLookupError(null);
    setFound(null);
    startSearch(async () => {
      const res = await discoverWhatsAppNumbers(businessId, token);
      if (!res.ok) {
        setLookupError(res.error);
        return;
      }
      setFound(res);
      if (res.reason) setLookupError(res.reason);
      const current = res.numbers.find((n) => n.phoneNumberId === phoneId);
      const pick = current ?? (res.numbers.length === 1 ? res.numbers[0] : null);
      if (pick) {
        setPhoneId(pick.phoneNumberId);
        setAccountId(pick.wabaId);
      }
    });
  }

  const expiry = found ? expiryLabel(found.expiresAt) : null;

  return (
    <div className="space-y-5">
      <p className="mt-4 text-sm text-ink">
        {connected ? (
          <>
            Tu WhatsApp ya está conectado. Solo vuelve aquí si Meta te avisa que el token <strong>venció</strong> o si quieres cambiar de número.
          </>
        ) : (
          <>
            Sin esto tu agente de IA <strong>no puede enviar ni recibir</strong> mensajes de WhatsApp. Solo necesitas <strong>un dato: el token</strong> que te da Meta. Con él
            encontramos tu número por ti.
          </>
        )}
      </p>

      {signup && (
        <>
          <FacebookConnect businessId={businessId} appId={signup.appId} configId={signup.configId} connected={connected} />
          <p className="flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-border" />o conéctalo con un token
            <span className="h-px flex-1 bg-border" />
          </p>
        </>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="wabaPhoneNumberId" value={phoneId} />
        <input type="hidden" name="wabaId" value={accountId} />

        <section className="space-y-2.5 rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">1</span>
            Pega tu token de acceso
          </h3>
          <p className="text-[13px] text-ink-muted">Es la clave que le da permiso a tu agente de usar tu WhatsApp. La genera Meta; abajo te explicamos cómo.</p>
          <div className="flex gap-2">
            <input
              id="wabaAccessToken"
              name="wabaAccessToken"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setFound(null);
                setLookupError(null);
              }}
              placeholder={connected ? "Pega aquí el token nuevo (déjalo vacío para conservar el actual)" : "Pega aquí el token que te dio Meta"}
              autoComplete="off"
              spellCheck={false}
              aria-label="Token de acceso"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="flex-none rounded-lg border border-border px-3 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              {showToken ? "Ocultar" : "Ver"}
            </button>
          </div>
          <button
            type="button"
            onClick={search}
            disabled={searching || !token.trim()}
            className="rounded-lg border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent/20 disabled:opacity-50"
          >
            {searching ? "Buscando tus números…" : "Buscar mis números"}
          </button>
          {lookupError && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{lookupError}</p>}

          <details className="group rounded-lg bg-surface-2/60 p-3 text-[13px] text-ink-muted">
            <summary className="cursor-pointer font-semibold text-ink">¿Cómo consigo el token? (paso a paso)</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                Entra a <span className="fl-mono text-ink">business.facebook.com</span> → <strong>Configuración del negocio</strong> (la rueda).
              </li>
              <li>
                Ve a <strong>Usuarios → Usuarios del sistema</strong> y crea uno (nombre: Funnels, rol <strong>Administrador</strong>).
              </li>
              <li>
                Pulsa <strong>Asignar activos</strong> y dale control total a tu <strong>cuenta de WhatsApp</strong> y a tu <strong>app</strong>.
              </li>
              <li>
                Pulsa <strong>Generar token</strong>, elige la app, en vencimiento escoge <strong>Nunca</strong> y marca{" "}
                <span className="fl-mono text-ink">whatsapp_business_management</span> y <span className="fl-mono text-ink">whatsapp_business_messaging</span>.
              </li>
              <li>Copia el token y pégalo arriba. Con un token permanente no tendrás que volver a hacer esto.</li>
            </ol>
            <p className="mt-2">
              ¿Usas el token de prueba que aparece en <span className="fl-mono text-ink">developers.facebook.com → tu app → WhatsApp → Configuración de la API</span>? Sirve para
              probar, pero vence cada ~24 horas.
            </p>
          </details>
        </section>

        {found && found.numbers.length > 0 && (
          <section className="space-y-2.5 rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">2</span>
              Elige el número que atenderá el agente
            </h3>
            {expiry && (
              <p className={`rounded-lg px-3 py-2 text-[13px] font-medium ${expiry.good ? "bg-accent/10 text-ink" : "border border-error/40 bg-error/10 text-error"}`}>
                {expiry.good ? "✓ " : "⚠ "}
                {expiry.text}
              </p>
            )}
            <ul className="space-y-1.5" role="radiogroup" aria-label="Números de WhatsApp">
              {found.numbers.map((n) => {
                const on = n.phoneNumberId === phoneId;
                return (
                  <li key={n.phoneNumberId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setPhoneId(n.phoneNumberId);
                        setAccountId(n.wabaId);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${on ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"}`}
                    >
                      <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-border-strong"}`}>
                        {on && <span className="h-2 w-2 rounded-full bg-accent" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{n.displayPhoneNumber}</span>
                        {n.verifiedName && <span className="block truncate text-xs text-ink-muted">{n.verifiedName}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <details className="rounded-xl border border-border p-4 text-[13px] text-ink-muted" open={!found && !connected && Boolean(lookupError)}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">Prefiero escribir los IDs a mano (opción avanzada)</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label htmlFor="manualPhoneId" className="fl-mono text-xs tracking-wide text-ink uppercase">
                Phone Number ID
              </label>
              <p>
                Lo ves en <span className="fl-mono text-ink">WhatsApp Manager → Configuración de la API → Números de teléfono</span>. No es tu número de teléfono normal.
              </p>
              <input id="manualPhoneId" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} autoComplete="off" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="manualWabaId" className="fl-mono text-xs tracking-wide text-ink uppercase">
                ID de la cuenta de WhatsApp Business (WABA ID)
              </label>
              <p>Hace falta para crear plantillas de mensajes y para recibir los mensajes. Está en la misma pantalla de Meta.</p>
              <input id="manualWabaId" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" className={inputClass} />
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando y verificando…" : connected ? "Guardar cambios" : "Guardar y conectar"}
        </button>

        {state.saved && !isPending && (
          <div
            className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm font-medium"
            style={{
              borderColor: `rgba(${WHATSAPP_GREEN}, 0.4)`,
              backgroundColor: `rgba(${WHATSAPP_GREEN}, 0.14)`,
              color: `rgba(${WHATSAPP_GREEN}, 1)`,
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 flex-none">
              <path
                d="M4 10.5 8 14l8-8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              Guardado y verificado con Meta
              {state.connectedNumber ? ` — quedó conectado al número ${state.connectedNumber}` : ""}.
            </span>
          </div>
        )}

        {state.error && (
          <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">
            {state.error}
          </div>
        )}
      </form>
    </div>
  );
}
