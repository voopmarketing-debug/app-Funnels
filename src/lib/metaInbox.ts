import { MetaApiError, graph } from "@/lib/metaSocial";

// Messenger and Instagram Direct conversations of the connected Page, read
// live from Meta's Conversations API and answered by people on the team
// (never by the AI agent: that one is WhatsApp-only on purpose). Only the
// read/resolved state is ours (SocialThreadState).

export type InboxNetwork = "facebook" | "instagram";

export type InboxThread = {
  id: string;
  network: InboxNetwork;
  /** PSID (Messenger) or IGSID (Instagram): who a reply goes to. */
  customerId: string;
  customerName: string;
  snippet: string;
  updatedAt: string;
  /** The last message came from the customer (so it's waiting on us). */
  lastFromCustomer: boolean;
  /** When the customer last wrote: replies are only allowed within 24 h of it. */
  lastCustomerAt: string | null;
};

export type InboxAttachment = { kind: "image" | "video" | "audio" | "file"; url: string; name?: string };

export type InboxMessage = {
  id: string;
  fromCustomer: boolean;
  text: string;
  createdAt: string;
  attachments: InboxAttachment[];
  /** "Respondió a tu historia" / "Te mencionó en su historia". */
  storyNote: string | null;
};

/** Meta allows a standard reply only within this window after the customer's last message. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Meta refused because the token lacks the messaging permissions (connected before the inbox existed). */
export function isMissingPermission(err: unknown): boolean {
  return err instanceof MetaApiError && (err.code === 10 || err.code === 200 || err.code === 3 || /permission|permiso/i.test(err.message));
}

type RawParticipant = { id: string; name?: string; username?: string };
type RawMessage = {
  id: string;
  message?: string;
  created_time: string;
  from?: { id: string; name?: string; username?: string };
  attachments?: { data: { mime_type?: string; name?: string; file_url?: string; image_data?: { url: string }; video_data?: { url: string } }[] };
  sticker?: string;
  story?: { reply_to?: { link?: string }; mention?: { link?: string } };
};
type RawConversation = {
  id: string;
  updated_time: string;
  snippet?: string;
  participants?: { data: RawParticipant[] };
  messages?: { data: RawMessage[] };
};

const PLATFORM: Record<InboxNetwork, string> = { facebook: "messenger", instagram: "instagram" };

export async function listThreads(params: { pageId: string; igUserId: string | null; pageToken: string; network: InboxNetwork }): Promise<InboxThread[]> {
  const { pageId, igUserId, pageToken, network } = params;
  // The business's own id on each side, to tell its messages from the customer's.
  const ownIds = new Set([pageId, igUserId].filter(Boolean) as string[]);
  const res = await graph<{ data: RawConversation[] }>(
    `${pageId}/conversations`,
    {
      platform: PLATFORM[network],
      fields: "id,updated_time,snippet,participants,messages.limit(6){message,from,created_time}",
      limit: "40",
    },
    pageToken,
  );
  return res.data.map((c) => {
    const customer = c.participants?.data.find((p) => !ownIds.has(p.id)) ?? c.participants?.data[0];
    const msgs = c.messages?.data ?? []; // newest first
    const last = msgs[0];
    const lastCustomer = msgs.find((m) => m.from && !ownIds.has(m.from.id));
    return {
      id: c.id,
      network,
      customerId: customer?.id ?? "",
      customerName: customer?.name ?? (customer?.username ? `@${customer.username}` : "Cliente"),
      snippet: c.snippet ?? last?.message ?? "",
      updatedAt: c.updated_time,
      lastFromCustomer: last?.from ? !ownIds.has(last.from.id) : true,
      lastCustomerAt: lastCustomer?.created_time ?? null,
    };
  });
}

function toAttachments(m: RawMessage): InboxAttachment[] {
  const out: InboxAttachment[] = [];
  for (const a of m.attachments?.data ?? []) {
    if (a.image_data?.url) out.push({ kind: "image", url: a.image_data.url });
    else if (a.video_data?.url) out.push({ kind: "video", url: a.video_data.url });
    else if (a.file_url) out.push({ kind: a.mime_type?.startsWith("audio") ? "audio" : "file", url: a.file_url, name: a.name });
  }
  if (m.sticker) out.push({ kind: "image", url: m.sticker });
  return out;
}

export async function threadMessages(params: { conversationId: string; pageId: string; igUserId: string | null; pageToken: string }): Promise<InboxMessage[]> {
  const ownIds = new Set([params.pageId, params.igUserId].filter(Boolean) as string[]);
  const res = await graph<{ messages?: { data: RawMessage[] } }>(
    params.conversationId,
    { fields: "messages.limit(60){id,message,from,created_time,attachments{mime_type,name,file_url,image_data,video_data},sticker,story}" },
    params.pageToken,
  );
  return (res.messages?.data ?? [])
    .map((m) => ({
      id: m.id,
      fromCustomer: m.from ? !ownIds.has(m.from.id) : true,
      text: m.message ?? "",
      createdAt: m.created_time,
      attachments: toAttachments(m),
      storyNote: m.story?.reply_to ? "Respondió a tu historia" : m.story?.mention ? "Te mencionó en su historia" : null,
    }))
    .reverse(); // oldest first, like a chat
}

/** Sends a text reply. Meta rejects it outside the 24-hour window. */
export async function sendReply(params: { pageId: string; pageToken: string; recipientId: string; text: string }): Promise<void> {
  const url = new URL(`https://graph.facebook.com/v21.0/${params.pageId}/messages`);
  url.searchParams.set("access_token", params.pageToken);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: params.recipientId }, messaging_type: "RESPONSE", message: { text: params.text } }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };
  if (!res.ok || json.error) {
    const code = json.error?.code;
    // 10 / 2018278: outside the allowed window. 551: the person can't receive messages.
    if (code === 10 || json.error?.error_subcode === 2018278) {
      throw new MetaApiError("Pasaron más de 24 horas desde el último mensaje de esta persona: Meta no deja responder hasta que vuelva a escribir.", code);
    }
    if (code === 551) throw new MetaApiError("Esta persona no puede recibir mensajes en este momento.", code);
    throw new MetaApiError(json.error?.error_user_msg || json.error?.message || `Meta respondió ${res.status}`, code);
  }
}
