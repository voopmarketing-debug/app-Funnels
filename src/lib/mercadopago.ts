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

export type MpPayment = {
  id: string;
  approved: boolean;
  payer: MpPayer;
  externalReference: string | null;
  amount: number;
  currency: string;
  description: string;
};

/** For a one-time payment notification (type: "payment"). */
export async function fetchMpPayment(id: string): Promise<MpPayment | null> {
  const payment = await mpGet(`/v1/payments/${id}`);
  if (!payment) return null;
  return {
    id: String(payment.id ?? id),
    approved: payment.status === "approved",
    payer: (payment.payer as MpPayer) ?? {},
    externalReference: typeof payment.external_reference === "string" ? payment.external_reference : null,
    amount: typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0,
    currency: typeof payment.currency_id === "string" ? payment.currency_id : "",
    description: typeof payment.description === "string" ? payment.description : "",
  };
}

/**
 * A one-off Checkout Pro link for one specific purchase. external_reference
 * carries our own id, so when the payment is approved the webhook knows
 * exactly which account and pack it was for — no matching by email needed.
 */
export async function createMpCheckoutLink(params: {
  title: string;
  priceCop: number;
  externalReference: string;
  payerEmail?: string;
  backUrl: string;
}): Promise<string | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return null;
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: params.title, quantity: 1, unit_price: params.priceCop, currency_id: "COP" }],
      external_reference: params.externalReference,
      notification_url: `https://${host}/api/webhooks/mercadopago`,
      back_urls: { success: params.backUrl, pending: params.backUrl, failure: params.backUrl },
      auto_return: "approved",
      ...(params.payerEmail ? { payer: { email: params.payerEmail } } : {}),
    }),
  });
  if (!res.ok) {
    console.error("Mercado Pago preference error", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { init_point?: string };
  return data.init_point ?? null;
}

/** For a subscription notification (type: "subscription_preapproval" / "preapproval"). */
export async function fetchMpPreapproval(id: string): Promise<{ approved: boolean; email: string } | null> {
  const sub = await mpGet(`/preapproval/${id}`);
  if (!sub) return null;
  return { approved: sub.status === "authorized", email: typeof sub.payer_email === "string" ? sub.payer_email : "" };
}
