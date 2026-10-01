// Pure (no server imports) so the chat composer can check a file BEFORE
// uploading it, with exactly the same limits the server enforces.

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
