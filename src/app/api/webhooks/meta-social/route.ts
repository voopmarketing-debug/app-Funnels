import { NextRequest, NextResponse, after } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { verifyWebhookSignature } from "@/lib/whatsapp";
import { commentsInPayload, connectionsFor, handleIncomingComment } from "@/lib/commentAutoReply";

// Meta's webhook for the connected Pages: new Facebook comments ("feed") and
// Instagram comments ("comments"). Only used for keyword auto-replies (see
// lib/commentAutoReply.ts); everything else in Redes is read live.

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const verifyToken = process.env.META_SOCIAL_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  if (params.get("hub.mode") === "subscribe" && challenge && token && verifyToken && safeEqual(token, verifyToken)) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return new NextResponse("Server misconfigured", { status: 500 });
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }
  const found = commentsInPayload(payload);
  // Meta wants a quick 200; the replies go out right after.
  if (found.length > 0) {
    after(async () => {
      for (const f of found) {
        try {
          for (const connection of await connectionsFor(f.where)) {
            await handleIncomingComment(connection, f.comment);
          }
        } catch (err) {
          console.error("[meta-social webhook] auto-reply failed", err);
        }
      }
    });
  }
  return NextResponse.json({ received: true });
}
