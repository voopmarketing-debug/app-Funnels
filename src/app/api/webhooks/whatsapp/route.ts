import { NextRequest, NextResponse, after } from "next/server";
import { maybeRetryPendingReplies } from "@/lib/replyRecovery";
import {
  countInboundMessages,
  parseInboundMessages,
  parseStatusUpdates,
  phoneNumberIdsInPayload,
  verifyWebhookSignature,
} from "@/lib/whatsapp";
import { reportWebhookProblemForPhoneNumberIds } from "@/lib/whatsappHealth";
import { formatPhone } from "@/lib/contactDisplay";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/agent";
import { applyDeliveryStatus } from "@/lib/deliveryTracking";
import { safeEqual } from "@/lib/crypto";

// One-time handshake Meta performs when you save the webhook URL in the App Dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && challenge && token && verifyToken && safeEqual(token, verifyToken)) {
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
    // Usually META_APP_SECRET doesn't match the Meta app sending the
    // webhooks — every message is then rejected. The payload is untrusted
    // here, so it's only used to know which business to warn (alerts are
    // throttled, see reportWebhookProblem).
    const ids = phoneNumberIdsInPayload(safeJsonParse(rawBody));
    await reportWebhookProblemForPhoneNumberIds(
      ids,
      "Meta envió un mensaje pero la firma no coincidió y se rechazó. Revisa que META_APP_SECRET en Vercel sea el «Secreto de la app» de tu app de Meta.",
    ).catch((err) => console.error("Failed to report webhook signature problem:", err));
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload: unknown = JSON.parse(rawBody);
  const messages = parseInboundMessages(payload);
  const phoneNumberIds = phoneNumberIdsInPayload(payload);
  // "Meta is delivering to us" heartbeat for the health panel.
  if (phoneNumberIds.length > 0) {
    await prisma.business
      .updateMany({ where: { wabaPhoneNumberId: { in: phoneNumberIds } }, data: { lastWebhookAt: new Date() } })
      .catch((err) => console.error("Failed to record webhook heartbeat:", err));
  }
  const unreadable = countInboundMessages(payload) - messages.length;
  if (unreadable > 0) {
    await reportWebhookProblemForPhoneNumberIds(
      phoneNumberIds,
      `Meta envió ${unreadable} mensaje(s) que la plataforma no pudo leer. Avísale a soporte para revisarlo.`,
    ).catch((err) => console.error("Failed to report unreadable messages:", err));
  }
  // Delivery receipts (sent/delivered/read/failed) for OUR outbound sends —
  // arrives in the same payload shape as inbound messages, just under
  // "statuses" instead of "messages" — see lib/deliveryTracking.ts.
  const statusUpdates = parseStatusUpdates(payload);

  // Meta requires a fast 200 response; process messages after acknowledging
  // would be ideal with a queue, but for MVP volume we await them inline.
  const results = await Promise.allSettled([
    // A failure here means the customer's message was NOT saved — alert the
    // business instead of only logging it where nobody looks.
    ...messages.map((m) =>
      handleIncomingMessage(m).catch(async (err) => {
        const reason = err instanceof Error ? err.message : String(err);
        await reportWebhookProblemForPhoneNumberIds(
          [m.phoneNumberId],
          `Llegó un mensaje de ${formatPhone(m.from)} pero falló al guardarse (${reason.slice(0, 200)}). Pídele que vuelva a escribir.`,
        ).catch(() => {});
        throw err;
      }),
    ),
    ...statusUpdates.map(applyDeliveryStatus),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to handle inbound WhatsApp webhook item:", result.reason);
    }
  }

  // After acknowledging Meta: retry any chat of these businesses that's still
  // unanswered (a failed AI call or send, a reply Meta reported undelivered,
  // a function that timed out mid-reply). Throttled per business.
  if (phoneNumberIds.length > 0) {
    after(async () => {
      try {
        const businesses = await prisma.business.findMany({
          where: { wabaPhoneNumberId: { in: phoneNumberIds } },
          select: { id: true },
        });
        await maybeRetryPendingReplies(businesses.map((b) => b.id));
      } catch (err) {
        console.error("Reply recovery (webhook) failed:", err);
      }
    });
  }

  return NextResponse.json({ received: true });
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
