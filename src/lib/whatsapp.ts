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

export type OutboundMediaType = "image" | "document" | "audio" | "video";

/** Sends a media message by public link — Meta fetches the file itself, no upload-to-Meta step needed. */
export async function sendWhatsAppMediaMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  type: OutboundMediaType;
  link: string;
  caption?: string;
  filename?: string;
}): Promise<{ messageId: string }> {
  const { phoneNumberId, accessToken, to, type, link, caption, filename } = params;

  // Meta doesn't support a caption on audio messages — silently dropped if passed.
  const mediaPayload: Record<string, string> = { link };
  if (caption && type !== "audio") mediaPayload.caption = caption;
  if (filename && type === "document") mediaPayload.filename = filename;

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
        type,
        [type]: mediaPayload,
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
 * Looks up the short-lived download URL for an inbound media id. Meta's own
 * URL expires a few minutes after being issued, so callers must download it
 * immediately and re-host the bytes themselves (see lib/attachments.ts) —
 * never store this URL directly.
 */
export async function fetchWhatsAppMediaMeta(params: {
  mediaId: string;
  accessToken: string;
}): Promise<{ url: string; mimeType: string; fileSize: number } | null> {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.mediaId}`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!data.url) return null;

  return { url: data.url, mimeType: data.mime_type ?? "application/octet-stream", fileSize: data.file_size ?? 0 };
}

export async function downloadWhatsAppMedia(params: { url: string; accessToken: string }): Promise<Buffer> {
  const response = await fetch(params.url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!response.ok) throw new Error(`Failed to download WhatsApp media (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

export type InboundMediaType = "image" | "audio" | "document" | "video";

export type WhatsAppInboundMessage = {
  phoneNumberId: string;
  from: string;
  contactName?: string;
  // Text body for a text message, the caption for a media message (may be
  // empty — most images/voice notes arrive without one).
  text: string;
  whatsappMsgId: string;
  media?: { type: InboundMediaType; mediaId: string; filename?: string };
};

const INBOUND_MEDIA_TYPES = new Set<InboundMediaType>(["image", "audio", "document", "video"]);

/** Parses a Meta Cloud API webhook payload into the inbound messages it carries (text or media). */
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
        if (!isRecord(msg)) continue;
        const from = typeof msg.from === "string" ? msg.from : undefined;
        const whatsappMsgId = typeof msg.id === "string" ? msg.id : undefined;
        if (!from || !whatsappMsgId) continue;

        if (msg.type === "text") {
          const text = isRecord(msg.text) && typeof msg.text.body === "string" ? msg.text.body : undefined;
          if (!text) continue;
          messages.push({ phoneNumberId, from, contactName, whatsappMsgId, text });
          continue;
        }

        if (typeof msg.type === "string" && INBOUND_MEDIA_TYPES.has(msg.type as InboundMediaType)) {
          const mediaObj = isRecord(msg[msg.type]) ? (msg[msg.type] as Record<string, unknown>) : undefined;
          const mediaId = typeof mediaObj?.id === "string" ? mediaObj.id : undefined;
          if (!mediaId) continue;
          const caption = typeof mediaObj?.caption === "string" ? mediaObj.caption : "";
          const filename = typeof mediaObj?.filename === "string" ? mediaObj.filename : undefined;

          messages.push({
            phoneNumberId,
            from,
            contactName,
            whatsappMsgId,
            text: caption,
            media: { type: msg.type as InboundMediaType, mediaId, filename },
          });
        }
        // Other types (sticker, location, contacts, reactions, ...) are
        // silently skipped, same as before this function handled media.
      }
    }
  }

  return messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
