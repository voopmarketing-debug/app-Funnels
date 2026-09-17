import { NextRequest, NextResponse } from "next/server";
import { parseHotmartPurchase } from "@/lib/hotmart";
import { provisionClientFromPurchase } from "@/lib/provisioning";

// Hotmart sends a shared "Hottok" value on every webhook call (set once
// when you configure the webhook in Hotmart's dashboard) instead of a
// signed-body scheme like Meta's — see verifyWebhookSignature in
// lib/whatsapp.ts for that pattern, this is simpler.
export async function POST(req: NextRequest) {
  const expected = process.env.HOTMART_HOTTOK;
  if (!expected) {
    console.error("HOTMART_HOTTOK is not configured; rejecting webhook delivery.");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const hottok = req.headers.get("x-hotmart-hottok");
  if (hottok !== expected) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const payload: unknown = await req.json();
  const purchase = parseHotmartPurchase(payload);

  if (!purchase) {
    // Not an event we act on (e.g. PURCHASE_CANCELED, PURCHASE_REFUNDED) —
    // acknowledge so Hotmart doesn't retry, but do nothing.
    return NextResponse.json({ received: true, actioned: false });
  }

  try {
    const result = await provisionClientFromPurchase({
      businessName: purchase.name || purchase.productName || "Nuevo negocio",
      email: purchase.email,
      phone: purchase.phone,
    });

    if (result.status === "error") {
      console.error("Failed to provision client from Hotmart purchase:", result.message, purchase);
    }
  } catch (err) {
    console.error("Failed to provision client from Hotmart purchase:", err, purchase);
    // Still 200 — Hotmart would otherwise retry indefinitely on our own bug,
    // and we already logged it for manual follow-up.
  }

  return NextResponse.json({ received: true, actioned: true });
}
