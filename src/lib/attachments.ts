import { randomUUID } from "crypto";
import { del, head, put } from "@vercel/blob";
import { MAX_ATTACHMENT_BYTES, maxMbFor, resolveMediaType, type MediaType } from "@/lib/attachmentLimits";

export { MAX_ATTACHMENT_BYTES, maxMbFor, resolveMediaType, type MediaType } from "@/lib/attachmentLimits";

// Kept small on purpose — this list gets read into every single AI reply's
// prompt (see lib/ai.ts's buildAvailableMediaBlock), so it stays a curated
// "best sellers" shortlist the AI can actually reason over, not a full
// product catalog. Enforced both in addAgentMedia (lib/actions.ts) and in
// AgentMediaManager.tsx (which disables the upload form at the limit) so
// the UI never lets a client waste an upload only to have the server
// reject it.
export const MAX_AGENT_MEDIA_PER_BUSINESS = 10;

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

/** Folder the chat composer uploads into directly from the browser (see /api/attachments/upload). */
export function chatUploadPrefix(businessId: string): string {
  return `chat/${businessId}/`;
}

/**
 * Checks a file the browser uploaded straight to Blob before we hand its URL
 * to Meta. Nothing the browser says is trusted: the URL must be one of OUR
 * public blobs (head() only succeeds against our own store's token) inside
 * this business's chat folder, and the size/type come from Blob itself, so
 * the per-type WhatsApp limits hold even if someone bypasses the composer.
 */
export async function verifyChatUpload(params: {
  url: string;
  businessId: string;
  // Defaults to the chat folder; product photos live under products/.
  folder?: "chat" | "products";
}): Promise<{ url: string; mediaType: MediaType; contentType: string; size: number; pathname: string }> {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new Error("Archivo inválido");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    throw new Error("Archivo inválido");
  }
  const prefix = params.folder === "products" ? `products/${params.businessId}/` : chatUploadPrefix(params.businessId);
  if (!decodeURIComponent(parsed.pathname).startsWith(`/${prefix}`)) throw new Error("Archivo inválido");

  const blob = await head(params.url).catch(() => null);
  if (!blob || !blob.pathname.startsWith(prefix)) throw new Error("No encontramos el archivo subido, intenta de nuevo");

  const contentType = blob.contentType || "application/octet-stream";
  const mediaType = resolveMediaType(contentType);
  if (!mediaType) {
    await del(blob.url).catch(() => {});
    throw new Error("Tipo de archivo no soportado");
  }
  if (blob.size > MAX_ATTACHMENT_BYTES[mediaType]) {
    await del(blob.url).catch(() => {});
    throw new Error(`El archivo supera el máximo permitido (${maxMbFor(mediaType)} MB)`);
  }
  return { url: blob.url, mediaType, contentType, size: blob.size, pathname: blob.pathname };
}

/** Best-effort cleanup of a blob we no longer need (e.g. the WebM original of a converted voice note). */
export async function deleteAttachment(url: string): Promise<void> {
  await del(url).catch(() => {});
}
