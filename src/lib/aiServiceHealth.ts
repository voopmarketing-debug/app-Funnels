import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropicClient";
import type { HealthCheck } from "@/lib/whatsappHealth";

// The AI side of "is the agent actually able to answer?": WhatsApp can be
// perfectly connected and customers still get nothing if Anthropic rejects
// every call (unpaid balance, revoked key). This makes a real, 1-token call
// with the model the agents use, so the check fails for exactly the reasons
// a real reply would.

/** Plain-language reason for an Anthropic failure — shared with the reply path's alerts. */
export function describeAnthropicError(err: unknown): { billing: boolean; text: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (/credit balance|billing|payment|insufficient/i.test(message)) {
    return {
      billing: true,
      text: "Anthropic rechazó la llamada por falta de saldo. Recarga créditos en console.anthropic.com (Settings → Billing); los mensajes pendientes se responderán solos al recargar.",
    };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { billing: false, text: "La clave ANTHROPIC_API_KEY en Vercel no es válida o fue revocada. Genera una nueva en console.anthropic.com." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { billing: false, text: "Anthropic está limitando el volumen de llamadas (límite de uso). Se reintenta solo." };
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return { billing: false, text: "Anthropic está temporalmente saturado o no responde. Se reintenta solo." };
  }
  return { billing: false, text: `Anthropic devolvió un error: ${message.slice(0, 200)}` };
}

let cached: { at: number; check: HealthCheck } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function checkAnthropic(model = "claude-sonnet-5"): Promise<HealthCheck> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.check;
  let check: HealthCheck;
  if (!process.env.ANTHROPIC_API_KEY) {
    check = { label: "Inteligencia artificial", ok: false, detail: "Falta ANTHROPIC_API_KEY en Vercel." };
  } else {
    try {
      await anthropic.messages.create(
        { model, max_tokens: 1, messages: [{ role: "user", content: "ok" }] },
        { maxRetries: 1, timeout: 20_000 },
      );
      check = { label: "Inteligencia artificial", ok: true, detail: "Anthropic responde con normalidad (saldo y clave OK)." };
    } catch (err) {
      check = { label: "Inteligencia artificial", ok: false, detail: describeAnthropicError(err).text };
    }
  }
  cached = { at: Date.now(), check };
  return check;
}

/** OpenAI only powers voice notes (transcription + spoken replies) and website images — optional. */
export async function checkOpenAi(): Promise<HealthCheck> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      label: "Notas de voz",
      ok: true,
      detail: "OPENAI_API_KEY no está configurada: las notas de voz de los clientes no se transcriben (opcional).",
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (response.ok) return { label: "Notas de voz", ok: true, detail: "OpenAI responde con normalidad." };
    if (response.status === 401) {
      return { label: "Notas de voz", ok: false, detail: "La clave OPENAI_API_KEY en Vercel no es válida." };
    }
    return { label: "Notas de voz", ok: false, detail: `OpenAI respondió ${response.status}.` };
  } catch {
    return { label: "Notas de voz", ok: false, detail: "No se pudo contactar a OpenAI." };
  }
}
