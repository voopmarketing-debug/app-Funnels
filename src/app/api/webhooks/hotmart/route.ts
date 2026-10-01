import { NextRequest, NextResponse } from "next/server";
import { parseHotmartPurchase } from "@/lib/hotmart";
import { applyHotmartPayment } from "@/lib/payments";
import { safeEqual } from "@/lib/crypto";

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
  if (!hottok || !safeEqual(hottok, expected)) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const payload: unknown = await req.json();
  const purchase = parseHotmartPurchase(payload);

  if (!purchase) {
    // Not an event we act on (e.g. SUBSCRIPTION_CANCELLATION: the paid
    // period simply runs out) — acknowledge so Hotmart doesn't retry.
    return NextResponse.json({ received: true, actioned: false });
  }

  try {
    const result = await applyHotmartPayment(purchase);
    if (result.status === "ignored") console.warn("Hotmart payment not applied:", result.reason, purchase.transaction);
    return NextResponse.json({ received: true, actioned: result.status });
  } catch (err) {
    console.error("Failed to apply Hotmart payment:", err, purchase.transaction);
    // 500 so Hotmart retries: the claim was released, so the retry applies it.
    return new NextResponse("Error applying payment", { status: 500 });
  }
}
