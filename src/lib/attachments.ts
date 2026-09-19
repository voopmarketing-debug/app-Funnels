import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

export type MediaType = "image" | "audio" | "video" | "document";

// Meta's own WhatsApp Cloud API caps are higher (image 5MB, audio/video
// 16MB, document 100MB) — DOCUMENT is capped well below that here so one
// upload can't run up our own storage bill; the other types already sit at
// Meta's ceiling, since raising them further wouldn't help (WhatsApp would
// reject the send anyway).
export const MAX_ATTACHMENT_BYTES: Record<MediaType, number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

export function resolveMediaType(mimeType: string): MediaType | null {
  if (!mimeType) return null;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

export function maxMbFor(mediaType: MediaType): number {
  return Math.round(MAX_ATTACHMENT_BYTES[mediaType] / (1024 * 1024));
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "archivo";
}

/**
 * Uploads an attachment to our own public storage (Vercel Blob) — used both
 * for outbound sends from the dashboard and for inbound media re-hosted from
 * Meta, whose own media URLs expire a few minutes after being issued. The
 * random id in the key keeps two same-named uploads from colliding; blob
 * access is "public" because both Meta's servers (outbound) and the
 * dashboard's <img>/<audio> tags (inbound) need to fetch it without our own
 * auth — the URL itself is long and unguessable, same tradeoff most SaaS
 * attachment features make.
 */
export async function uploadAttachment(params: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<{ url: string; size: number }> {
  const key = `attachments/${randomUUID()}-${sanitizeFilename(params.filename)}`;
  const blob = await put(key, params.bytes, {
    access: "public",
    contentType: params.contentType,
  });
  return { url: blob.url, size: params.bytes.byteLength };
}
