// Mercado Pago's webhook only sends a resource type + id — never the buyer's
// data directly — so we always call back to MP's own API with our access
// token to fetch the real, current status before granting anything. That
// also means a forged webhook call can't provision an account by itself: at
// worst it makes us look up an id that isn't really approved.
const MP_API = "https://api.mercadopago.com";

export type MpNotification = { type: string; id: string };

export function parseMpNotification(body: unknown, searchParams: URLSearchParams): MpNotification | null {
  const root = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;

  // New format: JSON body {type, data:{id}}. Older IPN format: query params
  // ?topic=payment&id=123 or ?type=payment&data.id=123.
  const type = (typeof root.type === "string" && root.type) || (typeof root.topic === "string" && root.topic) || searchParams.get("type") || searchParams.get("topic");
  const id = (typeof data?.id === "string" && data.id) || searchParams.get("data.id") || searchParams.get("id");

  if (!type || !id) return null;
  return { type, id };
}

type MpPayer = { email?: string; first_name?: string; last_name?: string; phone?: { number?: string } };

async function mpGet(path: string): Promise<Record<string, unknown> | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    console.error("MERCADOPAGO_ACCESS_TOKEN is not configured");
    return null;
  }
  const res = await fetch(`${MP_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error("Mercado Pago API error", path, res.status, await res.text());
    return null;
  }
  return res.json();
}

/** For a one-time payment notification (type: "payment"). */
export async function fetchMpPayment(id: string): Promise<{ approved: boolean; payer: MpPayer } | null> {
  const payment = await mpGet(`/v1/payments/${id}`);
  if (!payment) return null;
  return { approved: payment.status === "approved", payer: (payment.payer as MpPayer) ?? {} };
}

/** For a subscription notification (type: "subscription_preapproval" / "preapproval"). */
export async function fetchMpPreapproval(id: string): Promise<{ approved: boolean; email: string } | null> {
  const sub = await mpGet(`/preapproval/${id}`);
  if (!sub) return null;
  return { approved: sub.status === "authorized", email: typeof sub.payer_email === "string" ? sub.payer_email : "" };
}
