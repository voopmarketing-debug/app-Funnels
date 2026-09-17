import { NextRequest, NextResponse } from "next/server";
import { parseMpNotification, fetchMpPayment, fetchMpPreapproval } from "@/lib/mercadopago";
import { provisionClientFromPurchase } from "@/lib/provisioning";

// Mercado Pago has no shared-secret header like Hotmart's Hottok — the real
// safety check is that we always re-fetch the resource from MP's own API
// with our access token before provisioning anything (see mercadopago.ts).
export async function POST(req: NextRequest) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    console.error("MERCADOPAGO_ACCESS_TOKEN is not configured; rejecting webhook delivery.");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Some MP notifications arrive with an empty body and everything in
    // query params — that's fine, parseMpNotification falls back to those.
  }

  const notification = parseMpNotification(body, req.nextUrl.searchParams);
  if (!notification) {
    return NextResponse.json({ received: true, actioned: false });
  }

  try {
    if (notification.type === "payment") {
      const payment = await fetchMpPayment(notification.id);
      if (payment?.approved && payment.payer.email) {
        const name = [payment.payer.first_name, payment.payer.last_name].filter(Boolean).join(" ");
        await provisionClientFromPurchase({
          businessName: name || "Nuevo negocio",
          email: payment.payer.email,
          phone: payment.payer.phone?.number ?? "",
        });
      }
    } else if (notification.type === "subscription_preapproval" || notification.type === "preapproval") {
      const sub = await fetchMpPreapproval(notification.id);
      if (sub?.approved && sub.email) {
        await provisionClientFromPurchase({ businessName: "Nuevo negocio", email: sub.email, phone: "" });
      }
    }
  } catch (err) {
    console.error("Failed to provision client from Mercado Pago notification:", err, notification);
    // Still 200 — MP retries aggressively on non-2xx, and we already logged
    // this for manual follow-up.
  }

  return NextResponse.json({ received: true, actioned: true });
}
