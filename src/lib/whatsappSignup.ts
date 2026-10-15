import { randomInt } from "crypto";

// Meta's "WhatsApp Embedded Signup": the person signs in with Facebook in a
// Meta window, picks (or creates) their WhatsApp number, and Meta hands us a
// one-time code plus the account and number IDs. These are the server-side
// steps that turn that into a working connection.

const GRAPH = "https://graph.facebook.com/v21.0";

/** Trades the one-time code from the Meta window for the business's access token. */
export async function exchangeSignupCode(code: string): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: "Falta configurar la app de Meta en el servidor." };
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, error: "No se pudo contactar a Meta. Inténtalo de nuevo." };
  }
  const body = (await response.json().catch(() => null)) as { access_token?: string; error?: { message?: string } } | null;
  if (!response.ok || !body?.access_token) {
    return { ok: false, error: body?.error?.message ? `Meta no aceptó la conexión: ${body.error.message}` : "Meta no aceptó la conexión. Vuelve a intentarlo." };
  }
  return { ok: true, accessToken: body.access_token };
}

/**
 * Activates a freshly added number for the Cloud API. A number that is
 * already active answers with an error that is safe to ignore, so this never
 * blocks the connection: it only reports.
 */
export async function registerPhoneNumber(params: { phoneNumberId: string; accessToken: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${GRAPH}/${params.phoneNumberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: String(randomInt(100000, 1000000)) }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: body?.error?.message ?? `Meta respondió ${response.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "sin respuesta" };
  }
}

/** The IDs Meta's window reports when the person finishes; anything else is ignored. */
export function parseSignupMessage(raw: unknown): { event: "FINISH"; phoneNumberId: string; wabaId: string } | { event: "CANCEL" | "ERROR" } | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as { type?: string; event?: string; data?: { phone_number_id?: string; waba_id?: string } };
  if (msg.type !== "WA_EMBEDDED_SIGNUP") return null;
  if (msg.event === "CANCEL") return { event: "CANCEL" };
  if (msg.event === "ERROR") return { event: "ERROR" };
  const phoneNumberId = msg.data?.phone_number_id;
  const wabaId = msg.data?.waba_id;
  if (msg.event === "FINISH" || phoneNumberId) {
    if (phoneNumberId && wabaId) return { event: "FINISH", phoneNumberId: String(phoneNumberId), wabaId: String(wabaId) };
  }
  return null;
}
