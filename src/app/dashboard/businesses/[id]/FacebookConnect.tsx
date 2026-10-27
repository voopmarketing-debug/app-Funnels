"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { activateWhatsAppNumber, connectWhatsAppWithFacebook } from "@/lib/actions";
import { parseSignupMessage } from "@/lib/whatsappSignup";
import { WHATSAPP_GREEN } from "./WhatsAppGuide";

type FbLoginResponse = { authResponse?: { code?: string } | null };
type FbSdk = {
  init: (opts: Record<string, unknown>) => void;
  login: (cb: (res: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_VERSION = "v21.0";

function loadSdk(appId: string): Promise<FbSdk> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: SDK_VERSION });
      resolve(window.FB!);
    };
    if (window.FB) return ready();
    window.fbAsyncInit = ready;
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.onerror = () => reject(new Error("sdk"));
    document.body.appendChild(script);
  });
}

type Phase = "loading" | "idle" | "waiting" | "saving" | "pin" | "activating" | "done";

/**
 * "Continuar con Facebook": Meta's own window asks the person to sign in and
 * pick or create their WhatsApp number; we get the connection back without
 * them ever seeing a token. A number that comes from another provider asks for
 * its two-step PIN once, here, instead of failing quietly. Only rendered when
 * the server has the app and the Embedded Signup configuration set.
 */
export function FacebookConnect({ businessId, appId, configId, connected }: { businessId: string; appId: string; configId: string; connected: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const sdk = useRef<FbSdk | null>(null);
  const ids = useRef<{ phoneNumberId: string; wabaId: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadSdk(appId)
      .then((fb) => {
        if (!alive) return;
        sdk.current = fb;
        setPhase("idle");
      })
      .catch(() => {
        if (!alive) return;
        setError("No pudimos cargar Facebook. Revisa tu conexión o desactiva el bloqueador de anuncios.");
        setPhase("idle");
      });
    const onMessage = (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(e.origin)) return;
      const msg = parseSignupMessage(e.data);
      if (!msg) return;
      if (msg.event === "FINISH") ids.current = { phoneNumberId: msg.phoneNumberId, wabaId: msg.wabaId };
      else {
        setPhase("idle");
        if (msg.event === "ERROR") setError("Meta no pudo completar la conexión. Inténtalo de nuevo.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, [appId]);

  async function finish(code: string) {
    setPhase("saving");
    // Meta reports the IDs in a message that can land just after the login callback.
    for (let i = 0; i < 20 && !ids.current; i++) await new Promise((r) => setTimeout(r, 200));
    const res = await connectWhatsAppWithFacebook(businessId, { code, ...ids.current });
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setNumber(res.displayPhoneNumber);
    if (res.needsPin) {
      setPhase("pin");
      return;
    }
    setPhase("done");
    router.refresh();
  }

  async function activate() {
    setError(null);
    setPhase("activating");
    const res = await activateWhatsAppNumber(businessId, pin);
    if (!res.ok) {
      setError(res.error);
      setPhase("pin");
      return;
    }
    setPhase("done");
    router.refresh();
  }

  function start() {
    if (!sdk.current) return;
    setError(null);
    ids.current = null;
    setPhase("waiting");
    sdk.current.login(
      (res) => {
        const code = res.authResponse?.code;
        if (code) void finish(code);
        else setPhase("idle");
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  if (phase === "done") {
    const digits = number?.replace(/\D/g, "") ?? "";
    return (
      <div className="space-y-3 rounded-2xl border p-5 text-center" style={{ borderColor: `rgba(${WHATSAPP_GREEN}, 0.5)`, backgroundColor: `rgba(${WHATSAPP_GREEN}, 0.1)` }}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: `rgb(${WHATSAPP_GREEN})` }}>
          <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
            <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="text-base font-bold text-ink">¡WhatsApp conectado!</p>
          <p className="mt-0.5 text-sm text-ink-muted">{number ? `Tu agente ya atiende el ${number}.` : "Tu agente ya puede recibir y responder mensajes."}</p>
        </div>
        {digits && (
          <a
            href={`https://wa.me/${digits}?text=${encodeURIComponent("Hola")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Probarlo ahora
          </a>
        )}
        <p className="mx-auto max-w-sm text-xs text-ink-muted">
          Meta cobra los mensajes de plantilla a <strong className="text-ink">tu cuenta de WhatsApp</strong>. Agrega tu método de pago en{" "}
          <a href="https://business.facebook.com/wa/manage/home" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            WhatsApp Manager ↗
          </a>
          .
        </p>
      </div>
    );
  }

  if (phase === "pin" || phase === "activating") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void activate();
        }}
        className="space-y-3 rounded-2xl border border-border p-5"
      >
        <div>
          <p className="text-base font-bold text-ink">Un último paso: el PIN de tu número</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {number ? `El ${number} ` : "Tu número "}venía de otra plataforma y tiene un PIN de 6 números. Escríbelo para activarlo aquí.
          </p>
        </div>
        <input
          id="whatsappPin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000"
          aria-label="PIN de 6 números"
          className="fl-mono w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pin.length !== 6 || phase === "activating"}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {phase === "activating" ? "Activando…" : "Activar mi número"}
        </button>
        <p className="text-xs text-ink-faint">
          ¿No lo recuerdas? Entra a la otra plataforma y desactiva la «verificación en dos pasos» del número, o <a href="/dashboard/guia-whatsapp#pin" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">mira cómo hacerlo</a>.
        </p>
        {error && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
      </form>
    );
  }

  const label =
    phase === "loading" ? "Cargando…" : phase === "waiting" ? "Completa la ventana de Meta…" : phase === "saving" ? "Conectando tu número…" : connected ? "Reconectar con Facebook" : "Continuar con Facebook";
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={start}
        disabled={phase !== "idle"}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#1877F2] px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#166fe0] disabled:opacity-60"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />
        </svg>
        {label}
      </button>
      {error && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
    </div>
  );
}
