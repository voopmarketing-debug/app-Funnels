"use client";

import { useCallback, useEffect, useState } from "react";

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

/** Push notifications for this device: current state plus turn on / off / test. */
function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone only supports push once the app is added to the home screen.
        if (!cancelled) setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        // Keep the server copy fresh (it may have been dropped or belong to another login).
        if (sub && Notification.permission === "granted") await saveSubscription(sub);
        if (cancelled) return;
        if (Notification.permission === "denied") setState("denied");
        else setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = (await (await fetch("/api/push/key", { cache: "no-store" })).json()) as { publicKey: string };
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      await saveSubscription(sub);
      setState("on");
      await fetch("/api/push/test", { method: "POST" });
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    await fetch("/api/push/test", { method: "POST" });
  }, []);

  return { state, busy, enable, disable, test };
}

/** Row inside the notifications dropdown. */
export function PushToggleRow() {
  const { state, busy, enable, disable, test } = usePush();
  if (state === "loading" || state === "unsupported") return null;
  return (
    <div className="space-y-1.5 border-t border-border px-3 py-2.5 text-xs">
      {state === "on" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink">🔔 Avisos en este dispositivo: activados</span>
          <span className="flex gap-2">
            <button type="button" onClick={test} className="font-semibold text-accent hover:underline">
              Probar
            </button>
            <button type="button" onClick={disable} disabled={busy} className="text-ink-muted hover:text-ink">
              Apagar
            </button>
          </span>
        </div>
      )}
      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="w-full rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Activando…" : "🔔 Avisarme cuando entre un chat"}
        </button>
      )}
      {state === "denied" && (
        <p className="text-ink-muted">Bloqueaste los avisos en este navegador. Actívalos en el candado 🔒 junto a la dirección de la página.</p>
      )}
      {state === "ios-install" && (
        <p className="text-ink-muted">
          En iPhone: toca <strong className="text-ink">Compartir → Agregar a inicio</strong>, abre la app desde ahí y activa los avisos.
        </p>
      )}
    </div>
  );
}

/** One-time invitation at the top of the dashboard until push is on (or dismissed). */
export function PushBanner() {
  const { state, busy, enable } = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a per-device preference once
      setDismissed(localStorage.getItem("fl-push-banner") === "hidden");
    } catch {
      setDismissed(false);
    }
  }, []);

  function hide() {
    setDismissed(true);
    try {
      localStorage.setItem("fl-push-banner", "hidden");
    } catch {
      // Private mode: it just shows again next time.
    }
  }

  if (dismissed || (state !== "off" && state !== "ios-install")) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <p className="flex-1 text-ink">
        <strong>🔔 Entérate al instante cuando un cliente te escriba.</strong>{" "}
        <span className="text-ink-muted">
          {state === "ios-install"
            ? "En iPhone: toca Compartir → Agregar a inicio, abre la app desde ahí y activa los avisos."
            : "Te avisamos en este dispositivo aunque no tengas el panel abierto."}
        </span>
      </p>
      <div className="flex gap-2">
        {state === "off" && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar avisos"}
          </button>
        )}
        <button type="button" onClick={hide} className="rounded-lg px-3 py-1.5 text-ink-muted hover:text-ink">
          Ahora no
        </button>
      </div>
    </div>
  );
}
