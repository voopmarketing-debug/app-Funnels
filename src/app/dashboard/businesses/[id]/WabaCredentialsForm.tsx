"use client";

import { useActionState, useState, useTransition } from "react";
import { FacebookConnect } from "./FacebookConnect";
import { WHATSAPP_GREEN, WhatsAppGlyph } from "./WhatsAppGuide";
import { discoverWhatsAppNumbers, updateWabaCredentials, type DiscoverNumbersResult } from "@/lib/actions";
import { AGENDA_CALL_URL, supportWhatsAppLink } from "@/lib/constants";

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
  isAgency = false,
}: {
  businessId: string;
  wabaPhoneNumberId: string;
  wabaId: string;
  /** Present only when the server has the Meta app and the Embedded Signup configuration. */
  signup?: { appId: string; configId: string } | null;
  /** Agency staff get a link to the Meta readiness page when the Facebook button is not available yet. */
  isAgency?: boolean;
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
            error: result.alreadyUsed ? result.verifyError : `Meta no aceptó estos datos y no guardamos nada: ${result.verifyError}`,
          };
        }
        return { saved: true, error: null, connectedNumber: result.displayPhoneNumber };
      } catch (err) {
        return { saved: false, connectedNumber: null, error: err instanceof Error ? err.message : "No se pudo guardar, intenta de nuevo" };
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
  const guideHref = "/dashboard/guia-whatsapp";
  const quickSteps = ["Entra con Facebook", "Elige o crea tu número", "¡Listo!"];

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white" style={{ background: `rgb(${WHATSAPP_GREEN})` }}>
            <WhatsAppGlyph className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink">{connected ? "Tu WhatsApp está conectado" : "Conecta tu WhatsApp"}</h3>
            <p className="text-sm text-ink-muted">{connected ? "Solo vuelve si cambias de número o Meta te avisa de un problema." : "Toma 2 minutos. Sin copiar claves."}</p>
          </div>
        </div>

        {signup ? (
          <>
            <ol className="grid grid-cols-3 gap-2 text-center">
              {quickSteps.map((label, i) => (
                <li key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2/60 px-2 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">{i + 1}</span>
                  <span className="text-xs font-semibold leading-tight text-ink">{label}</span>
                </li>
              ))}
            </ol>
            <FacebookConnect businessId={businessId} appId={signup.appId} configId={signup.configId} connected={connected} />
            <p className="text-center text-sm text-ink-muted">
              ¿Primera vez o dudas?{" "}
              <a href={guideHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                Abre la guía paso a paso ↗
              </a>
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              La conexión con un clic todavía no está activa en esta plataforma. Mientras tanto, <strong className="text-ink">te conectamos nosotros</strong> en una llamada corta.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={AGENDA_CALL_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">
                Agendar la llamada
              </a>
              <a
                href={supportWhatsAppLink("Hola, necesito ayuda para conectar mi WhatsApp en Funnels Labs")}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold text-ink transition hover:border-border-strong"
              >
                Escribirnos por WhatsApp
              </a>
            </div>
            {isAgency && (
              <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-ink">
                Eres de la agencia: para activar el botón de Facebook a tus clientes, revisa{" "}
                <a href="/dashboard/meta" className="font-semibold text-accent hover:underline">
                  Conexión Meta
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>

      <details className="group rounded-2xl border border-border p-4 text-sm" open={Boolean(state.error) || Boolean(lookupError)}>
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
          <span className="flex items-center justify-between gap-2">
            Ya tengo un token de Meta
            <span className="text-xs font-medium text-ink-faint transition group-open:rotate-180" aria-hidden="true">
              ▾
            </span>
          </span>
        </summary>
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="wabaPhoneNumberId" value={phoneId} />
          <input type="hidden" name="wabaId" value={accountId} />

          <div className="space-y-2">
            <label htmlFor="wabaAccessToken" className="text-xs font-bold tracking-wide text-ink-faint uppercase">
              Token permanente
            </label>
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
                placeholder={connected ? "Token nuevo (vacío = conservar el actual)" : "Pega aquí tu token"}
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
              />
              <button type="button" onClick={() => setShowToken((v) => !v)} className="flex-none rounded-lg border border-border px-3 text-xs font-semibold text-ink-muted hover:text-ink">
                {showToken ? "Ocultar" : "Ver"}
              </button>
            </div>
            <p className="text-xs text-ink-faint">
              ¿No sabes cómo sacarlo?{" "}
              <a href={`${guideHref}#token`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                Mira la guía ↗
              </a>
            </p>
            <button
              type="button"
              onClick={search}
              disabled={searching || !token.trim()}
              className="rounded-lg border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent/20 disabled:opacity-50"
            >
              {searching ? "Buscando…" : "Buscar mis números"}
            </button>
            {lookupError && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{lookupError}</p>}
          </div>

          {found && found.numbers.length > 0 && (
            <div className="space-y-2">
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
            </div>
          )}

          <details className="rounded-xl border border-border p-3 text-[13px] text-ink-muted">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Escribir los IDs a mano</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label htmlFor="manualPhoneId" className="fl-mono text-xs tracking-wide text-ink uppercase">
                  Phone Number ID
                </label>
                <input id="manualPhoneId" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} autoComplete="off" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label htmlFor="manualWabaId" className="fl-mono text-xs tracking-wide text-ink uppercase">
                  WABA ID
                </label>
                <input id="manualWabaId" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" className={inputClass} />
              </div>
              <p className="text-xs">
                Dónde verlos:{" "}
                <a href={`${guideHref}#token`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                  guía ↗
                </a>
              </p>
            </div>
          </details>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
          >
            {isPending ? "Verificando con Meta…" : connected ? "Guardar cambios" : "Guardar y conectar"}
          </button>

          {state.saved && !isPending && (
            <div
              className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm font-medium"
              style={{ borderColor: `rgba(${WHATSAPP_GREEN}, 0.4)`, backgroundColor: `rgba(${WHATSAPP_GREEN}, 0.14)`, color: `rgba(${WHATSAPP_GREEN}, 1)` }}
            >
              <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true">
                <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Conectado{state.connectedNumber ? ` al número ${state.connectedNumber}` : ""}. Prueba escribiéndole «Hola» desde otro teléfono.</span>
            </div>
          )}
          {state.error && <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">{state.error}</div>}
        </form>
      </details>
    </div>
  );
}
