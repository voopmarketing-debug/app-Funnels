import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_API_VERSION = "v21.0";

export async function sendWhatsAppTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<{ messageId: string }> {
  const { phoneNumberId, accessToken, to, text } = params;

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { messages?: { id: string }[] };
  const messageId = data.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp API did not return a message id");

  return { messageId };
}

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook
 * delivery, proving the payload was not forged or tampered with in transit.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}

export type WhatsAppInboundMessage = {
  phoneNumberId: string;
  from: string;
  contactName?: string;
  text: string;
  whatsappMsgId: string;
};

/** Parses a Meta Cloud API webhook payload into the inbound text messages it carries. */
export function parseInboundMessages(payload: unknown): WhatsAppInboundMessage[] {
  const messages: WhatsAppInboundMessage[] = [];

  const entries = isRecord(payload) && Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = isRecord(change) ? change.value : undefined;
      if (!isRecord(value)) continue;

      const metadata = isRecord(value.metadata) ? value.metadata : undefined;
      const phoneNumberId = typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : undefined;
      if (!phoneNumberId) continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactName =
        isRecord(contacts[0]) && isRecord(contacts[0].profile) && typeof contacts[0].profile.name === "string"
          ? contacts[0].profile.name
          : undefined;

      const waMessages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of waMessages) {
        if (!isRecord(msg) || msg.type !== "text") continue;
        const text = isRecord(msg.text) && typeof msg.text.body === "string" ? msg.text.body : undefined;
        const from = typeof msg.from === "string" ? msg.from : undefined;
        const whatsappMsgId = typeof msg.id === "string" ? msg.id : undefined;
        if (!text || !from || !whatsappMsgId) continue;

        messages.push({ phoneNumberId, from, contactName, text, whatsappMsgId });
      }
    }
  }

  return messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
