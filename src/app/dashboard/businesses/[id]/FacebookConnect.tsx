"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { connectWhatsAppWithFacebook } from "@/lib/actions";
import { parseSignupMessage } from "@/lib/whatsappSignup";

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

type Phase = "loading" | "idle" | "waiting" | "saving" | "done";

/**
 * "Conectar con Facebook": Meta's own window asks the person to sign in and
 * pick their WhatsApp number; we get the connection back without them ever
 * seeing a token. Only shown when the server has the app and the Embedded
 * Signup configuration set.
 */
export function FacebookConnect({ businessId, appId, configId, connected }: { businessId: string; appId: string; configId: string; connected: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
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
    return (
      <div className="rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm font-medium text-ink">
        ✓ WhatsApp conectado{number ? ` al número ${number}` : ""}. Tu agente ya puede recibir y responder mensajes. Pruébalo escribiéndole «Hola» desde otro teléfono.
      </div>
    );
  }

  const busy = phase !== "idle";
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2.5 rounded-xl bg-[#1877F2] px-6 py-3 text-[15px] font-semibold text-white shadow-md transition hover:bg-[#166fe0] disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />
        </svg>
        {phase === "loading" ? "Cargando…" : phase === "waiting" ? "Completa la ventana de Meta…" : phase === "saving" ? "Conectando tu número…" : connected ? "Reconectar con Facebook" : "Conectar con Facebook"}
      </button>
      {phase === "waiting" && <p className="text-xs text-ink-muted">Sigue los pasos de la ventana de Meta. Esta pantalla se actualiza sola cuando termines.</p>}
      {error && <p className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
    </div>
  );
}
