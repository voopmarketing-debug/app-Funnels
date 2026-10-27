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

// Pictures, audio, video and the documents a chat or a catalog needs. Not
// "application/*" or "text/*": HTML, SVG, scripts or executables would be
// served from the storage's public address under the platform's name.
export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "audio/*",
  "video/*",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
];

/** True when a declared MIME type (parameters like ";codecs=opus" ignored) is one of the allowed ones. */
export function isAllowedUploadType(mimeType: string): boolean {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (!base) return false;
  return ALLOWED_UPLOAD_TYPES.some((allowed) => (allowed.endsWith("/*") ? base.startsWith(allowed.slice(0, -1)) : base === allowed));
}
