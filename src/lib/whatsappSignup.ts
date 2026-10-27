import { randomInt } from "crypto";

// Meta's "WhatsApp Embedded Signup": the person signs in with Facebook in a
// Meta window, picks (or creates) their WhatsApp number, and Meta hands us a
// one-time code plus the account and number IDs. These are the server-side
// steps that turn that into a working connection.

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * The page address the browser reports, kept only when it belongs to this
 * platform (never a value another site could make us send to Meta).
 */
export function ownPageUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.host !== host) return undefined;
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

/**
 * The window opened by Meta's JavaScript SDK has no redirect of its own, and
 * Meta checks the one sent when trading the code against the one used to open
 * it. Which value it accepts is not obvious, so each refusal about the
 * redirect is retried with the next candidate: the page the button was pressed
 * on (fragment included), none, empty, and the site. A refusal does not spend
 * the code (what the logs show is which candidate Meta accepted).
 */
function redirectUriAttempts(pageUrl: string | undefined): { label: string; value: string | undefined }[] {
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  const attempts: { label: string; value: string | undefined }[] = [];
  // Meta's dialog reports the page it was opened from as "fallback_redirect_uri",
  // fragment included; the code appears to be tied to that address.
  if (pageUrl) attempts.push({ label: "página del botón", value: pageUrl });
  attempts.push({ label: "sin redirect_uri", value: undefined }, { label: "redirect_uri vacío", value: "" }, { label: "raíz del sitio", value: `https://${host}/` });
  return attempts;
}

const REDIRECT_REFUSAL = /redirect_uri|can't load url|verification code|app's domains/i;

type TokenReply = { access_token?: string; error?: { message?: string } } | null;

/** Trades the one-time code from the Meta window for the business's access token. */
export async function exchangeSignupCode(code: string, pageUrl?: string): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: "Falta configurar la app de Meta en el servidor." };
  let lastMessage: string | null = null;
  for (const attempt of redirectUriAttempts(ownPageUrl(pageUrl))) {
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("code", code);
    if (attempt.value !== undefined) url.searchParams.set("redirect_uri", attempt.value);
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      return { ok: false, error: "No se pudo contactar a Meta. Inténtalo de nuevo." };
    }
    const body = (await response.json().catch(() => null)) as TokenReply;
    if (response.ok && body?.access_token) {
      console.info(`WhatsApp signup code accepted (${attempt.label}).`);
      return { ok: true, accessToken: body.access_token };
    }
    lastMessage = body?.error?.message ?? null;
    console.warn(`WhatsApp signup code refused (${attempt.label}): ${lastMessage ?? `HTTP ${response.status}`}`);
    if (!lastMessage || !REDIRECT_REFUSAL.test(lastMessage)) break;
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
