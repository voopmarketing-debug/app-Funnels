import { NextRequest, NextResponse } from "next/server";
import { parseInboundMessages, verifyWebhookSignature } from "@/lib/whatsapp";
import { handleIncomingMessage } from "@/lib/agent";

// One-time handshake Meta performs when you save the webhook URL in the App Dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Meta delivers every inbound WhatsApp message (across all connected businesses) here.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("META_APP_SECRET is not configured; rejecting webhook delivery.");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload: unknown = JSON.parse(rawBody);
  const messages = parseInboundMessages(payload);

  // Meta requires a fast 200 response; process messages after acknowledging
  // would be ideal with a queue, but for MVP volume we await them inline.
  const results = await Promise.allSettled(messages.map(handleIncomingMessage));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to handle inbound WhatsApp message:", result.reason);
    }
  }

  return NextResponse.json({ received: true });
}
