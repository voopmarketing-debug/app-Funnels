import { randomInt } from "crypto";

// Meta's "WhatsApp Embedded Signup": the person signs in with Facebook in a
// Meta window, picks (or creates) their WhatsApp number, and Meta hands us a
// one-time code plus the account and number IDs. These are the server-side
// steps that turn that into a working connection.

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * The window opened by Meta's JavaScript SDK has no redirect of its own, and
 * Meta checks the one sent when trading the code against the one used to open
 * it. Which value it accepts is not obvious (none, empty, or the site), so a
 * refusal that names redirect_uri is retried with the next one. The code is
 * not spent by a refusal.
 */
function redirectUriAttempts(): (string | undefined)[] {
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  return [undefined, "", `https://${host}/`];
}

type TokenReply = { access_token?: string; error?: { message?: string } } | null;

/** Trades the one-time code from the Meta window for the business's access token. */
export async function exchangeSignupCode(code: string): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: "Falta configurar la app de Meta en el servidor." };
  let lastMessage: string | null = null;
  for (const redirectUri of redirectUriAttempts()) {
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("code", code);
    if (redirectUri !== undefined) url.searchParams.set("redirect_uri", redirectUri);
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      return { ok: false, error: "No se pudo contactar a Meta. Inténtalo de nuevo." };
    }
    const body = (await response.json().catch(() => null)) as TokenReply;
    if (response.ok && body?.access_token) return { ok: true, accessToken: body.access_token };
    lastMessage = body?.error?.message ?? null;
    if (!lastMessage || !/redirect_uri/i.test(lastMessage)) break;
  }
  return { ok: false, error: lastMessage ? `Meta no aceptó la conexión: ${lastMessage}` : "Meta no aceptó la conexión. Vuelve a intentarlo." };
}

export type RegisterResult = { ok: true } | { ok: false; error: string; /** The number has two-step verification on: Meta wants its 6-digit PIN. */ needsPin: boolean };

/** Meta's 6-digit two-step verification PIN. */
export const isValidPin = (pin: string): boolean => /^\d{6}$/.test(pin);

// 133005: PIN mismatch; the number already has a two-step verification PIN
// (it came from another provider) and ours is not it.
const PIN_ERROR_CODES = new Set([133005]);

/**
 * Activates a number for the Cloud API. With no PIN it picks a new one (right
 * for a number just added). A number that comes from another provider usually
 * has two-step verification on: Meta then answers that the PIN does not match,
 * and the person's own PIN has to be sent (see the "pin" argument). Never
 * blocks the connection: it only reports.
 */
export async function registerPhoneNumber(params: { phoneNumberId: string; accessToken: string; pin?: string }): Promise<RegisterResult> {
  try {
    const response = await fetch(`${GRAPH}/${params.phoneNumberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: params.pin ?? String(randomInt(100000, 1000000)) }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    const code = body?.error?.code;
    const message = body?.error?.message ?? `Meta respondió ${response.status}`;
    return { ok: false, error: message, needsPin: (code !== undefined && PIN_ERROR_CODES.has(code)) || /two.?step.*pin|pin.*mismatch/i.test(message) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "sin respuesta", needsPin: false };
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
