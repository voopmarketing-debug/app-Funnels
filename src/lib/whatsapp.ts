import { isBsuid } from "@/lib/contactDisplay";
import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_API_VERSION = "v21.0";


/** Meta's error responses are JSON with the useful bit nested in error.message — this pulls that out so a failed send shows a human sentence instead of a raw JSON blob. */
function parseMetaErrorMessage(status: number, rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: string; error_data?: { details?: string } } };
    const details = parsed.error?.error_data?.details;
    const message = parsed.error?.message;
    if (message) return details ? `${message} (${details})` : message;
  } catch {
    // Not JSON — fall through to the raw body below.
  }
  return `Meta respondió con un error (${status}): ${rawBody}`;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs one message to Meta's /messages endpoint. Every outbound send (AI
 * reply, manual reply, media, template, broadcast) goes through here, so a
 * momentary hiccup — Meta rate-limiting (429), a 5xx, a dropped connection —
 * is retried a couple of times instead of silently costing a customer their
 * reply. For a username contact (BSUID), if Meta rejects the "recipient"
 * field it's retried once with the id in "to", since Meta's rollout of
 * BSUID sending hasn't reached every account at the same time.
 */
async function postMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  message: Record<string, unknown>;
}): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}/messages`;
  const addressings: Record<string, string>[] = isBsuid(params.to)
    ? [{ recipient: params.to }, { to: params.to }]
    : [{ to: params.to }];

  let lastError = "WhatsApp API did not return a message id";
  for (const addressing of addressings) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", ...addressing, ...params.message }),
        });
      } catch (err) {
        lastError = `No se pudo contactar a Meta: ${err instanceof Error ? err.message : String(err)}`;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (response.ok) {
        const data = (await response.json()) as { messages?: { id: string }[] };
        const messageId = data.messages?.[0]?.id;
        if (!messageId) throw new Error("WhatsApp API did not return a message id");
        return { messageId };
      }

      lastError = parseMetaErrorMessage(response.status, await response.text());
      if (!RETRYABLE_STATUS.has(response.status)) break; // try the next addressing (BSUID) or give up
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw new Error(lastError);
}

export async function sendWhatsAppTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<{ messageId: string }> {
  const { phoneNumberId, accessToken, to, text } = params;

  return postMessage({
    phoneNumberId,
    accessToken,
    to,
    message: {
      type: "text",
      text: { body: text },
    },
  });
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

/**
 * Which Meta apps are subscribed to this WhatsApp Business Account's
 * webhooks. If OUR app isn't in the list, Meta never sends us inbound
 * messages for any number on the account — they just vanish, with no error
 * anywhere on our side. That's the most common "a customer wrote and
 * nothing arrived" cause (e.g. after reconnecting the number in Meta).
 */
export async function fetchWabaSubscribedApps(params: {
  wabaId: string;
  accessToken: string;
}): Promise<{ ok: true; appIds: string[] } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const body = (await response.json().catch(() => null)) as {
      data?: { whatsapp_business_api_data?: { id?: string } }[];
      error?: { message?: string };
    } | null;
    if (!response.ok) return { ok: false, error: body?.error?.message ?? `Meta respondió ${response.status}` };
    const appIds = (body?.data ?? []).map((d) => d.whatsapp_business_api_data?.id).filter((id): id is string => !!id);
    return { ok: true, appIds };
  } catch {
    return { ok: false, error: "No se pudo contactar a Meta" };
  }
}

/** Subscribes the app that owns this token to the WABA's webhooks (Meta's "subscribed_apps" POST). */
export async function subscribeAppToWaba(params: {
  wabaId: string;
  accessToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${params.wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: body?.error?.message ?? `Meta respondió ${response.status}` };
  } catch {
    return { ok: false, error: "No se pudo contactar a Meta" };
  }
}

/** How many real (non-reaction) inbound messages a payload carries — to detect any the parser couldn't read. */
export function countInboundMessages(payload: unknown): number {
  let count = 0;
  const entries = isRecord(payload) && Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = isRecord(change) && isRecord(change.value) ? change.value : undefined;
      const msgs = value && Array.isArray(value.messages) ? value.messages : [];
      count += msgs.filter((m) => isRecord(m) && m.type !== "reaction").length;
    }
  }
  return count;
}

/** Best-effort list of phone_number_ids a webhook payload is about — for health tracking, not for trust decisions. */
export function phoneNumberIdsInPayload(payload: unknown): string[] {
  const ids = new Set<string>();
  const entries = isRecord(payload) && Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = isRecord(change) && isRecord(change.value) ? change.value : undefined;
      const metadata = value && isRecord(value.metadata) ? value.metadata : undefined;
      if (typeof metadata?.phone_number_id === "string") ids.add(metadata.phone_number_id);
    }
  }
  return Array.from(ids);
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

  return postMessage({
    phoneNumberId,
    accessToken,
    to,
    message: {
      type,
      [type]: mediaPayload,
    },
  });
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
    throw new Error(parseMetaErrorMessage(response.status, body));
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

  return postMessage({
    phoneNumberId,
    accessToken,
    to,
    message: {
      type: "template",
      template: { name: templateName, language: { code: language }, ...(components ? { components } : {}) },
    },
  });
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

// Text for inbound message types that aren't plain text or downloadable
// media. Returns null for types that shouldn't create a message at all.
function describeNonTextMessage(msg: Record<string, unknown>): string | null {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const obj = (v: unknown) => (isRecord(v) ? v : undefined);
  switch (msg.type) {
    case "reaction":
      return null;
    case "button":
      // Quick-reply button on a template message.
      return str(obj(msg.button)?.text) ?? "[Tocó un botón de la plantilla]";
    case "interactive": {
      const interactive = obj(msg.interactive);
      const reply = obj(interactive?.button_reply) ?? obj(interactive?.list_reply);
      return str(reply?.title) ?? "[Respuesta a un mensaje interactivo]";
    }
    case "location": {
      const loc = obj(msg.location);
      const lat = loc?.latitude;
      const lng = loc?.longitude;
      const place = [str(loc?.name), str(loc?.address)].filter(Boolean).join(", ");
      const link = typeof lat === "number" && typeof lng === "number" ? ` https://maps.google.com/?q=${lat},${lng}` : "";
      return `[Ubicación compartida${place ? `: ${place}` : ""}]${link}`;
    }
    case "contacts": {
      const list = Array.isArray(msg.contacts) ? msg.contacts : [];
      const described = list
        .map((c) => {
          const card = obj(c);
          const name = str(obj(card?.name)?.formatted_name);
          const phones = (Array.isArray(card?.phones) ? card.phones : [])
            .map((ph) => str(obj(ph)?.phone))
            .filter(Boolean)
            .join(", ");
          return [name, phones].filter(Boolean).join(" ");
        })
        .filter(Boolean);
      return `[Contacto compartido${described.length ? `: ${described.join("; ")}` : ""}]`;
    }
    case "sticker":
      return "[Sticker]";
    case "unsupported":
      // Meta delivers some WhatsApp features only inside the app (error
      // 131051 "Message type unknown"): view-once photos/videos, polls,
      // events, edited messages, video notes… The API gets no content, so
      // say what it probably was and how to get it — this text is also what
      // the AI reads, so it asks the customer to resend it.
      return "[El cliente envió algo que WhatsApp no deja ver fuera de su app (por ejemplo una foto o video de «ver una vez», una encuesta, un evento o un mensaje editado). Pídele que lo reenvíe como texto, foto o audio normal.]";
    default:
      return `[Mensaje de tipo "${typeof msg.type === "string" ? msg.type : "desconocido"}" que no se puede mostrar aquí; revísalo en WhatsApp]`;
  }
}

function nonEmpty(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Who sent this message. Since Meta's 2026 WhatsApp usernames rollout, a
 * NEW customer who uses a username can arrive with no phone number at all:
 * "from"/"wa_id" missing (or holding a business-scoped user ID) and the
 * identity only in "from_user_id"/"user_id". This used to require "from",
 * so those first messages were dropped silently — existing chats kept
 * working, but new contacts never reached the CRM or the AI. The phone is
 * still preferred whenever Meta sends it, so existing contacts keep matching
 * their stored conversation.
 */
function senderIdentity(msg: Record<string, unknown>, contact: Record<string, unknown> | undefined): string | undefined {
  const candidates = [msg.from, contact?.wa_id, msg.from_user_id, msg.user_id, contact?.user_id]
    .map(nonEmpty)
    .filter((c): c is string => !!c);
  return candidates.find((c) => /^\d{6,15}$/.test(c)) ?? candidates[0];
}

/** Parses a Meta Cloud API webhook payload into the inbound messages it carries (text, media, or a text description of other types). */
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
      const contact = isRecord(contacts[0]) ? contacts[0] : undefined;
      const profile = contact && isRecord(contact.profile) ? contact.profile : undefined;
      const contactName = nonEmpty(profile?.name) ?? nonEmpty(profile?.username) ?? nonEmpty(contact?.username);

      const waMessages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of waMessages) {
        if (!isRecord(msg)) continue;
        const from = senderIdentity(msg, contact);
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
          continue;
        }

        // Everything else used to be dropped silently, so e.g. a customer
        // tapping a template's quick-reply button, or sharing a location,
        // never reached the CRM and got no reply. Now each becomes text the
        // business (and the AI) can read. Reactions are the one exception:
        // an emoji on an earlier message isn't a new message to answer.
        const text = describeNonTextMessage(msg);
        if (text) messages.push({ phoneNumberId, from, contactName, whatsappMsgId, text });
      }
    }
  }

  return messages;
}

export type WhatsAppStatusUpdate = {
  whatsappMsgId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: number; // unix seconds, from Meta
  errorMessage?: string;
  errorCode?: number; // Meta error code, e.g. 131047 = 24h window closed
};

const KNOWN_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

/**
 * Parses the "statuses" array Meta's webhook carries alongside (or instead
 * of) inbound messages — one per outbound message as it moves through
 * sent → delivered → read (or → failed). Used to power delivery/read KPIs
 * for broadcasts and regular replies alike (see lib/deliveryTracking.ts).
 */
export function parseStatusUpdates(payload: unknown): WhatsAppStatusUpdate[] {
  const updates: WhatsAppStatusUpdate[] = [];

  const entries = isRecord(payload) && Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = isRecord(change) ? change.value : undefined;
      if (!isRecord(value)) continue;

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const s of statuses) {
        if (!isRecord(s)) continue;
        const whatsappMsgId = typeof s.id === "string" ? s.id : undefined;
        const status = typeof s.status === "string" ? s.status : undefined;
        if (!whatsappMsgId || !status || !KNOWN_STATUSES.has(status)) continue;

        const timestampRaw = typeof s.timestamp === "string" ? parseInt(s.timestamp, 10) : Number(s.timestamp);
        const timestamp = Number.isFinite(timestampRaw) ? timestampRaw : Math.floor(Date.now() / 1000);

        const errors = Array.isArray(s.errors) ? s.errors : [];
        const firstError = isRecord(errors[0]) ? errors[0] : undefined;
        const errorMessage = typeof firstError?.title === "string" ? firstError.title : undefined;
        const errorCode = typeof firstError?.code === "number" ? firstError.code : undefined;

        updates.push({ whatsappMsgId, status: status as WhatsAppStatusUpdate["status"], timestamp, errorMessage, errorCode });
      }
    }
  }

  return updates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
