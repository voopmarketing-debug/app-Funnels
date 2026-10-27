"use client";

import { useActionState, useState, useTransition } from "react";
import { FacebookConnect } from "./FacebookConnect";
import { Callout, Checklist, Chip, OpenLink, Screens, Step, Steps, Trouble, WHATSAPP_GREEN, WhatsAppGlyph } from "./WhatsAppGuide";
import { discoverWhatsAppNumbers, updateWabaCredentials, type DiscoverNumbersResult } from "@/lib/actions";
import { AGENDA_CALL_URL, SUPPORT_WHATSAPP_LINK, supportWhatsAppLink } from "@/lib/constants";

type SaveState = { saved: boolean; error: string | null; connectedNumber: string | null };
type Found = Extract<DiscoverNumbersResult, { ok: true }>;
type Method = "facebook" | "token" | "help";

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink outline-none focus:border-accent";

function expiryLabel(iso: string | null): { text: string; good: boolean } {
  if (!iso) return { text: "Token permanente: no vence", good: true };
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours > 24 * 30) return { text: `Vence en ${Math.floor(hours / 24)} días`, good: true };
  const when = hours <= 48 ? `${Math.max(hours, 0)} horas` : `${Math.floor(hours / 24)} días`;
  return { text: `Este token vence en ${when}. Cuando venza, el agente deja de responder; mejor usa uno permanente`, good: false };
}

const PREPARE_ITEMS = [
  { key: "fb", label: <>Tengo mi <strong className="text-ink">cuenta de Facebook</strong> (la persona que administra el negocio en Meta).</> },
  {
    key: "number",
    label: (
      <>
        Tengo el <strong className="text-ink">número de WhatsApp del negocio</strong> y puedo recibir <strong className="text-ink">un SMS o una llamada</strong> en él: Meta manda un código para comprobar que es tuyo.
      </>
    ),
  },
  {
    key: "free",
    label: (
      <>
        Ese número <strong className="text-ink">no está abierto en la app de WhatsApp</strong> ni en WhatsApp Business. Si lo está, primero hay que eliminar su cuenta desde esa app (se pierden sus chats de ese teléfono).
      </>
    ),
  },
];

const META_SCREENS = [
  { title: "Inicia sesión con Facebook", text: <>Pulsa <Chip>Continuar</Chip> con tu cuenta. Si el negocio ya tiene un portafolio comercial, elígelo; si no, <Chip>Crear un portafolio</Chip> con el nombre de tu negocio.</> },
  { title: "Crea tu cuenta de WhatsApp Business", text: <>Escribe el <strong className="text-ink">nombre de tu negocio</strong> tal como lo verán tus clientes y elige la categoría que más se parezca. Es solo texto; lo puedes cambiar después.</> },
  { title: "Agrega tu número", text: <>Escribe el número <strong className="text-ink">con el código de país</strong> (en Colombia empieza con +57) y elige cómo recibir el código: <Chip>SMS</Chip> o <Chip>Llamada</Chip>.</> },
  { title: "Escribe el código de 6 dígitos", text: <>Es el que te llegó por SMS o llamada. Escríbelo en la ventana de Meta y pulsa <Chip>Verificar</Chip>.</> },
  { title: "Termina y vuelve aquí", text: <>Revisa que estés dando acceso a Funnels Labs y pulsa <Chip>Finalizar</Chip>. La ventana se cierra sola y aquí verás el aviso verde.</> },
];

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
  const [method, setMethod] = useState<Method>(signup ? "facebook" : "token");
  const [prepared, setPrepared] = useState<Record<string, boolean>>({});
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
  const allPrepared = PREPARE_ITEMS.every((i) => prepared[i.key]);

  const methods: { id: Method; title: string; subtitle: string; badge?: string }[] = [
    ...(signup ? [{ id: "facebook" as const, title: "Con Facebook", subtitle: "Una ventana de Meta te guía. Sin copiar claves.", badge: "Recomendado" }] : []),
    { id: "token", title: "Con un token de Meta", subtitle: "Si ya tienes tu WhatsApp API creada.", badge: signup ? "Avanzado" : undefined },
    { id: "help", title: "Que me ayuden", subtitle: "Lo conectamos juntos en una llamada." },
  ];

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 rounded-xl border p-3.5"
        style={connected ? { borderColor: `rgba(${WHATSAPP_GREEN}, 0.45)`, backgroundColor: `rgba(${WHATSAPP_GREEN}, 0.1)` } : undefined}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white" style={{ background: `rgb(${WHATSAPP_GREEN})` }}>
          <WhatsAppGlyph />
        </span>
        <p className="text-sm text-ink">
          {connected ? (
            <>
              <strong>Tu WhatsApp ya está conectado.</strong> Solo vuelve aquí si Meta te avisa que el token <strong>venció</strong> o si quieres cambiar de número.
            </>
          ) : (
            <>
              <strong>Conecta tu número de WhatsApp Business.</strong> Sin esto tu agente <strong>no puede enviar ni recibir</strong> mensajes. Elige cómo quieres hacerlo; ninguna opción toma más de unos minutos.
            </>
          )}
        </p>
      </div>

      <div role="radiogroup" aria-label="Cómo conectar tu WhatsApp" className={`grid gap-2 ${methods.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {methods.map((m) => {
          const on = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMethod(m.id)}
              className={`relative rounded-xl border p-3 text-left transition ${on ? "border-accent bg-accent/10 shadow-sm" : "border-border hover:border-border-strong"}`}
            >
              <span className="mb-1.5 block h-[18px]">
                {m.badge && (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] leading-none font-bold tracking-wide uppercase ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted"}`}>{m.badge}</span>
                )}
              </span>
              <span className="block text-sm font-semibold text-ink">{m.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{m.subtitle}</span>
            </button>
          );
        })}
      </div>

      {method === "facebook" && signup && (
        <Steps>
          <Step n={1} title="Ten estas 3 cosas a la mano" time="1 min" done={allPrepared}>
            <Checklist
              idPrefix="prep"
              items={PREPARE_ITEMS}
              checked={prepared}
              onToggle={(key) => setPrepared((p) => ({ ...p, [key]: !p[key] }))}
            />
          </Step>
          <Step n={2} title="Esto es lo que verás en la ventana de Meta" time="lee, no hagas nada todavía">
            <Screens items={META_SCREENS} />
            <Callout tone="info" title="El nombre de tu negocio en WhatsApp">
              Meta revisa el nombre que verán tus clientes. Puede tardar un poco en aprobarse; mientras tanto tu agente ya queda conectado, solo que tus clientes pueden ver tu número en lugar del nombre.
            </Callout>
          </Step>
          <Step n={3} title="Pulsa el botón y sigue la ventana" time="2 a 5 min">
            <FacebookConnect businessId={businessId} appId={signup.appId} configId={signup.configId} connected={connected} />
            <p className="text-xs text-ink-faint">Si no se abre ninguna ventana, permite las ventanas emergentes de este sitio en tu navegador y vuelve a pulsar.</p>
          </Step>
          <Step n={4} title="Comprueba que funciona" last>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Cuando termine verás aquí un aviso verde con tu número. Para probarlo, <strong className="text-ink">escribe «Hola» a ese número desde otro teléfono</strong>: tu agente debería responder en unos segundos.
            </p>
            <div className="space-y-2">
              <h4 className="text-xs font-bold tracking-wide text-ink-faint uppercase">Si algo no sale</h4>
              <Trouble problem="Meta dice que el número ya está registrado" fix={<>Está abierto en la app de WhatsApp o WhatsApp Business. Elimina esa cuenta desde la app (Ajustes → Cuenta → Eliminar cuenta) y vuelve a intentarlo, o usa otro número.</>} />
              <Trouble problem="No me llega el código" fix={<>Elige <Chip>Llamada</Chip> en lugar de SMS, revisa que el teléfono tenga señal y espera un minuto antes de pedirlo otra vez.</>} />
              <Trouble problem="La ventana se cierra o se queda en blanco" fix={<>Permite las ventanas emergentes, desactiva el bloqueador de anuncios en esta página y prueba de nuevo. Si sigue igual, escríbenos.</>} />
            </div>
            <div className="flex flex-wrap gap-2">
              <OpenLink href={SUPPORT_WHATSAPP_LINK}>Escribir a soporte</OpenLink>
              <button type="button" onClick={() => setMethod("help")} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
                Prefiero que me ayuden
              </button>
            </div>
          </Step>
        </Steps>
      )}

      {method === "help" && (
        <div className="space-y-3">
          <Callout tone="tip" title="Lo hacemos juntos, sin que te pelees con Meta">
            En una llamada de <strong className="text-ink">30 a 45 minutos</strong> te acompañamos a crear la cuenta de WhatsApp Business, agregar tu número y dejar el agente respondiendo.
          </Callout>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={AGENDA_CALL_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-accent/50 bg-accent/10 p-4 transition hover:bg-accent/15">
              <span className="block text-sm font-semibold text-ink">Agendar la llamada guiada</span>
              <span className="mt-0.5 block text-xs text-ink-muted">Elige el día y la hora que te sirvan.</span>
            </a>
            <a
              href={supportWhatsAppLink("Hola, necesito ayuda para conectar mi WhatsApp en Funnels Labs")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border p-4 transition hover:border-border-strong"
            >
              <span className="block text-sm font-semibold text-ink">Escribirnos por WhatsApp</span>
              <span className="mt-0.5 block text-xs text-ink-muted">Te contestamos una persona, no un robot.</span>
            </a>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs font-bold tracking-wide text-ink-faint uppercase">Ten a la mano en la llamada</h4>
            <Checklist idPrefix="help" items={PREPARE_ITEMS} checked={prepared} onToggle={(key) => setPrepared((p) => ({ ...p, [key]: !p[key] }))} />
          </div>
        </div>
      )}

      {method === "token" && (
        <form action={formAction}>
          <input type="hidden" name="wabaPhoneNumberId" value={phoneId} />
          <input type="hidden" name="wabaId" value={accountId} />

          <div className="mb-4">
            <Callout tone="warn" title="Camino avanzado">
              Necesitas un <strong className="text-ink">token permanente</strong> de Meta (una clave larga que empieza con «EAA…»). Si no sabes qué es, usa {signup ? <><strong className="text-ink">«Con Facebook»</strong> o </> : "la opción "}<strong className="text-ink">«Que me ayuden»</strong>.
            </Callout>
          </div>

          <Steps>
            <Step n={1} title="Genera tu token permanente en Meta" time="5 min" done={Boolean(token.trim())}>
              <ol className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
                <li>
                  <span className="mr-1.5 font-bold text-ink">a.</span>Entra a <strong className="text-ink">Configuración del negocio</strong> (la rueda) en business.facebook.com.
                </li>
                <li>
                  <span className="mr-1.5 font-bold text-ink">b.</span>Ve a <Chip>Usuarios</Chip> → <Chip>Usuarios del sistema</Chip> y crea uno: nombre «Funnels», rol <Chip>Administrador</Chip>.
                </li>
                <li>
                  <span className="mr-1.5 font-bold text-ink">c.</span>Pulsa <Chip>Asignar activos</Chip> y dale <strong className="text-ink">control total</strong> a tu <strong className="text-ink">cuenta de WhatsApp</strong> y a tu <strong className="text-ink">app</strong>.
                </li>
                <li>
                  <span className="mr-1.5 font-bold text-ink">d.</span>Pulsa <Chip>Generar token</Chip>, elige la app, en vencimiento escoge <Chip>Nunca</Chip> y marca <Chip>whatsapp_business_management</Chip> y <Chip>whatsapp_business_messaging</Chip>.
                </li>
                <li>
                  <span className="mr-1.5 font-bold text-ink">e.</span>Copia el token. Con uno permanente no tendrás que repetir esto.
                </li>
              </ol>
              <OpenLink href="https://business.facebook.com/settings/system-users">Abrir Usuarios del sistema en Meta</OpenLink>
              <p className="text-xs text-ink-faint">
                ¿Usas el token de prueba de developers.facebook.com → tu app → WhatsApp → Configuración de la API? Sirve para probar, pero vence cada ~24 horas.
              </p>
            </Step>

            <Step n={2} title="Pégalo y busca tus números" time="1 min" done={Boolean(found && found.numbers.length > 0)}>
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
                  placeholder={connected ? "Pega aquí el token nuevo (vacío = conservar el actual)" : "Pega aquí el token que te dio Meta"}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Token de acceso"
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowToken((v) => !v)} className="flex-none rounded-lg border border-border px-3 text-xs font-semibold text-ink-muted hover:text-ink">
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
            </Step>

            <Step n={3} title="Elige el número que atenderá el agente" done={Boolean(found && found.numbers.length > 0 && phoneId)}>
              {found && found.numbers.length > 0 ? (
                <>
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
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">Aquí aparecerán tus números cuando pulses «Buscar mis números».</p>
              )}

              <details className="rounded-xl border border-border p-3 text-[13px] text-ink-muted" open={!found && !connected && Boolean(lookupError)}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Prefiero escribir los IDs a mano</summary>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="manualPhoneId" className="fl-mono text-xs tracking-wide text-ink uppercase">
                      Phone Number ID
                    </label>
                    <p>
                      Es un número largo de unos 15 dígitos. Lo ves en <strong className="text-ink">WhatsApp Manager → Configuración de la API → Números de teléfono</strong>. <strong className="text-ink">No es tu número de teléfono normal.</strong>
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
            </Step>

            <Step n={4} title={connected ? "Guarda los cambios" : "Guarda y conecta"} last>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
              >
                {isPending ? "Guardando y verificando con Meta…" : connected ? "Guardar cambios" : "Guardar y conectar"}
              </button>
              <p className="text-xs text-ink-faint">Antes de guardar, comprobamos con Meta que el token puede usar ese número.</p>

              {state.saved && !isPending && (
                <div
                  className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm font-medium"
                  style={{ borderColor: `rgba(${WHATSAPP_GREEN}, 0.4)`, backgroundColor: `rgba(${WHATSAPP_GREEN}, 0.14)`, color: `rgba(${WHATSAPP_GREEN}, 1)` }}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 flex-none">
                    <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>
                    Guardado y verificado con Meta
                    {state.connectedNumber ? ` — quedó conectado al número ${state.connectedNumber}` : ""}. Prueba escribiéndole «Hola» desde otro teléfono.
                  </span>
                </div>
              )}
              {state.error && <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">{state.error}</div>}
            </Step>
          </Steps>
        </form>
      )}

      <details className="rounded-xl border border-border p-3 text-[13px] text-ink-muted">
        <summary className="cursor-pointer text-sm font-semibold text-ink">¿Qué significa cada palabra?</summary>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="font-semibold text-ink">WhatsApp Business API</dt>
            <dd>La conexión oficial de Meta que permite que un programa (tu agente) conteste por ti. Es distinta de la app de WhatsApp del celular.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Portafolio comercial</dt>
            <dd>La «carpeta» de tu negocio dentro de Meta. Ahí viven tus cuentas de WhatsApp, páginas y anuncios.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Token de acceso</dt>
            <dd>Una clave que le da permiso a la plataforma de usar tu WhatsApp. Trátala como una contraseña: no la compartas.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Phone Number ID y WABA ID</dt>
            <dd>Dos códigos internos de Meta que identifican tu número y tu cuenta. No son tu número de teléfono.</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
