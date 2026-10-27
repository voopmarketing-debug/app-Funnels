import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { requireBusinessMembership } from "@/lib/authz";
import { ALLOWED_UPLOAD_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/attachmentLimits";

class UploadDenied extends Error {}

// Issues short-lived tokens so the chat composer can upload a file straight
// from the browser to Vercel Blob. Server Actions (and Vercel functions in
// general) cap request bodies around 4MB, far below the 16–20MB WhatsApp
// allows for videos, audio and documents. Only a signed-in member of the
// business gets a token, only under that business's own folder, only for
// the media types WhatsApp accepts, and never above the largest limit — the
// exact per-type limit is enforced again in sendManualMessage, which reads
// the real size and type from Blob instead of trusting the browser.
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user?.id) throw new UploadDenied("Inicia sesión para enviar archivos");
        let businessId: unknown;
        try {
          businessId = (JSON.parse(clientPayload ?? "{}") as { businessId?: unknown }).businessId;
        } catch {
          businessId = undefined;
        }
        if (typeof businessId !== "string" || !businessId) throw new UploadDenied("Falta el negocio");
        await requireBusinessMembership(session.user.id, businessId);
        // chat/: chat attachments; products/: product photos (see ProductManager);
        // agent-media/: photos and PDFs the AI sends by itself (see AgentMediaManager).
        if (!pathname.startsWith(`chat/${businessId}/`) && !pathname.startsWith(`products/${businessId}/`) && !pathname.startsWith(`agent-media/${businessId}/`)) {
          throw new UploadDenied("Ruta de archivo no permitida");
        }

        return {
          allowedContentTypes: ALLOWED_UPLOAD_TYPES,
          maximumSizeInBytes: Math.max(...Object.values(MAX_ATTACHMENT_BYTES)),
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    // Only the reasons written above reach the browser; anything else (a
    // database or storage error) is logged and answered generically.
    if (!(err instanceof UploadDenied)) console.error("attachments/upload failed:", err);
    return NextResponse.json({ error: err instanceof UploadDenied ? err.message : "No se pudo autorizar la subida" }, { status: 400 });
  }
}
