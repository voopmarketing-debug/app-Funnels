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

/** Looks up the actual dialable WhatsApp number behind a phone_number_id — needed to build a wa.me link (the id itself isn't dialable). */
export async function fetchWhatsAppDisplayNumber(params: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!response.ok) return null;

  const data = (await response.json()) as { display_phone_number?: string };
  return data.display_phone_number ?? null;
}

/**
 * Calls Meta's own API with the phoneNumberId + token exactly as saved, so
 * "guardado" actually means "Meta accepted these credentials" instead of
 * just "the database write succeeded". Used right after saving credentials
 * so a wrong/expired token or mistyped id is caught immediately instead of
 * surfacing later as a silent failure to send/receive messages.
 */
export async function verifyWabaConnection(params: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<{ ok: true; displayPhoneNumber: string | null; verifiedName: string | null } | { ok: false; error: string }> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  } catch {
    return { ok: false, error: "No se pudo contactar a Meta para verificar — inténtalo de nuevo en un momento." };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    const metaMessage = body?.error?.message;
    if (response.status === 401 || body?.error?.code === 190) {
      return { ok: false, error: "El token de acceso no es válido o venció. Genera uno nuevo en Meta y pégalo aquí." };
    }
    if (response.status === 404 || body?.error?.code === 100) {
      return { ok: false, error: "Meta no reconoce ese Phone Number ID — revisa que lo copiaste completo y sin espacios." };
    }
    return {
      ok: false,
      error: metaMessage
        ? `Meta rechazó estas credenciales: ${metaMessage}`
        : "Meta rechazó estas credenciales — revisa el Phone Number ID y el token.",
    };
  }

  const data = (await response.json()) as { display_phone_number?: string; verified_name?: string };
  return {
    ok: true,
    displayPhoneNumber: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
  };
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

export type TemplateCategory = "MARKETING" | "UTILITY";

export type TemplateButton = { type: "URL"; text: string; url: string };

/**
 * Uploads a file to Meta's Resumable Upload API and returns the "handle"
 * a template's HEADER IMAGE component needs as its `example.header_handle`
 * when submitted for approval (see createWhatsAppTemplate) — Meta doesn't
 * accept a plain URL there, only this handle. This is a one-time step at
 * creation; *sending* an already-approved template with an image header
 * just needs a normal link (see sendWhatsAppTemplateMessage).
 */
export async function uploadTemplateHeaderImage(params: {
  appId: string;
  accessToken: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ handle: string }> {
  const { appId, accessToken, bytes, contentType } = params;

  const sessionUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads`);
  sessionUrl.searchParams.set("file_length", String(bytes.length));
  sessionUrl.searchParams.set("file_type", contentType);
  sessionUrl.searchParams.set("access_token", accessToken);

  const sessionResponse = await fetch(sessionUrl, { method: "POST" });
  if (!sessionResponse.ok) {
    const body = await sessionResponse.text();
    throw new Error(`No se pudo iniciar la subida de la imagen a Meta (${sessionResponse.status}): ${body}`);
  }
  const session = (await sessionResponse.json()) as { id?: string };
  if (!session.id) throw new Error("Meta no devolvió una sesión de subida válida para la imagen");

  const uploadResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${session.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}`, file_offset: "0" },
    body: new Uint8Array(bytes),
  });
  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new Error(`No se pudo subir la imagen a Meta (${uploadResponse.status}): ${body}`);
  }
  const uploaded = (await uploadResponse.json()) as { h?: string };
  if (!uploaded.h) throw new Error("Meta no devolvió un identificador para la imagen subida");

  return { handle: uploaded.h };
}

/**
 * Submits a new message template to Meta for review. Templates are scoped
 * to the WhatsApp Business Account (wabaId), not the phone number — this is
 * a different id than wabaPhoneNumberId. Approval is entirely on Meta's
 * side (usually minutes to a day); the returned status is almost always
 * "PENDING" right after creation.
 */
export async function createWhatsAppTemplate(params: {
  wabaId: string;
  accessToken: string;
  name: string;
  language: string;
  category: TemplateCategory;
  bodyText: string;
  headerImageHandle?: string;
  buttons?: TemplateButton[];
}): Promise<{ id: string; status: string }> {
  const { wabaId, accessToken, name, language, category, bodyText, headerImageHandle, buttons } = params;

  const components: Record<string, unknown>[] = [];
  if (headerImageHandle) {
    components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [headerImageHandle] } });
  }
  components.push({ type: "BODY", text: bodyText });
  if (buttons && buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: buttons.map((b) => ({ type: b.type, text: b.text, url: b.url })) });
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, language, category, components }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { id?: string; status?: string };
  if (!data.id) throw new Error("WhatsApp API did not return a template id");

  return { id: data.id, status: data.status ?? "PENDING" };
}

/** Looks up a template's current review status by name — no status-update webhook is wired up, so this is polled on demand. */
export async function fetchWhatsAppTemplateStatus(params: {
  wabaId: string;
  accessToken: string;
  name: string;
}): Promise<{ status: string; rejectionReason: string | null } | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.wabaId}/message_templates`);
  url.searchParams.set("name", params.name);

  const response = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    data?: { status?: string; rejected_reason?: string }[];
  };
  const entry = data.data?.[0];
  if (!entry?.status) return null;

  return { status: entry.status, rejectionReason: entry.rejected_reason ?? null };
}

/** Sends an approved template message — the only way to message a customer outside Meta's 24h free-form window. */
export async function sendWhatsAppTemplateMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  // Only needed when the approved template has an IMAGE header — Meta
  // re-fetches this link on every send, same as a regular media message.
  // Static URL buttons need nothing here: Meta already has the button's
  // fixed url baked into the approved template.
  headerImageUrl?: string;
}): Promise<{ messageId: string }> {
  const { phoneNumberId, accessToken, to, templateName, language, headerImageUrl } = params;

  const components = headerImageUrl
    ? [{ type: "header", parameters: [{ type: "image", image: { link: headerImageUrl } }] }]
    : undefined;

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
        type: "template",
        template: { name: templateName, language: { code: language }, ...(components ? { components } : {}) },
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
