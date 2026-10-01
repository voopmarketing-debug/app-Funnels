// Mercado Pago's webhook only sends a resource type + id — never the buyer's
// data directly — so we always call back to MP's own API with our access
// token to fetch the real, current status before granting anything. That
// also means a forged webhook call can't provision an account by itself: at
// worst it makes us look up an id that isn't really approved.
// Overridable only so the webhook flow can be exercised against a local stand-in.
const MP_API = process.env.MERCADOPAGO_API_BASE || "https://api.mercadopago.com";

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
  // Raw MP status: approved, refunded, charged_back, pending, rejected…
  status: string;
  approvedAt: Date | null;
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
    status: typeof payment.status === "string" ? payment.status : "",
    approvedAt: typeof payment.date_approved === "string" ? new Date(payment.date_approved) : null,
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

export type MpPreapproval = {
  id: string;
  approved: boolean;
  status: string;
  email: string;
  // The subscription plan's title ("Funnels Labs Pro") and monthly amount.
  reason: string;
  amount: number;
  frequencyMonths: number;
  createdAt: Date;
};

/** For a subscription notification (type: "subscription_preapproval" / "preapproval"). */
export async function fetchMpPreapproval(id: string): Promise<MpPreapproval | null> {
  const sub = await mpGet(`/preapproval/${id}`);
  if (!sub) return null;
  const recurring = (sub.auto_recurring as Record<string, unknown> | undefined) ?? {};
  const frequency = typeof recurring.frequency === "number" ? recurring.frequency : 1;
  const frequencyType = typeof recurring.frequency_type === "string" ? recurring.frequency_type : "months";
  return {
    id: String(sub.id ?? id),
    approved: sub.status === "authorized",
    status: typeof sub.status === "string" ? sub.status : "",
    email: typeof sub.payer_email === "string" ? sub.payer_email : "",
    reason: typeof sub.reason === "string" ? sub.reason : "",
    amount: typeof recurring.transaction_amount === "number" ? recurring.transaction_amount : 0,
    frequencyMonths: frequencyType === "months" ? Math.max(1, frequency) : 1,
    createdAt: typeof sub.date_created === "string" ? new Date(sub.date_created) : new Date(),
  };
}

/**
 * One monthly charge of a subscription (type: "subscription_authorized_payment").
 * Each renewal is its own authorized payment, linked to its preapproval.
 */
export async function fetchMpAuthorizedPayment(
  id: string,
): Promise<{ id: string; preapprovalId: string; approved: boolean; amount: number; chargedAt: Date } | null> {
  const ap = await mpGet(`/authorized_payments/${id}`);
  if (!ap) return null;
  const payment = (ap.payment as Record<string, unknown> | undefined) ?? {};
  const when = (typeof ap.debit_date === "string" && ap.debit_date) || (typeof ap.date_created === "string" && ap.date_created) || "";
  return {
    id: String(ap.id ?? id),
    preapprovalId: typeof ap.preapproval_id === "string" ? ap.preapproval_id : "",
    approved: payment.status === "approved" || ap.status === "processed",
    amount: typeof ap.transaction_amount === "number" ? ap.transaction_amount : 0,
    chargedAt: when ? new Date(when) : new Date(),
  };
}
