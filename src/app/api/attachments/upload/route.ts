import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { requireBusinessMembership } from "@/lib/authz";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachmentLimits";

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
        if (!session?.user?.id) throw new Error("Inicia sesión para enviar archivos");
        let businessId: unknown;
        try {
          businessId = (JSON.parse(clientPayload ?? "{}") as { businessId?: unknown }).businessId;
        } catch {
          businessId = undefined;
        }
        if (typeof businessId !== "string" || !businessId) throw new Error("Falta el negocio");
        await requireBusinessMembership(session.user.id, businessId);
        // chat/: chat attachments; products/: product photos (see ProductManager).
        if (!pathname.startsWith(`chat/${businessId}/`) && !pathname.startsWith(`products/${businessId}/`)) {
          throw new Error("Ruta de archivo no permitida");
        }

        return {
          allowedContentTypes: ["image/*", "audio/*", "video/*", "application/*", "text/*"],
          maximumSizeInBytes: Math.max(...Object.values(MAX_ATTACHMENT_BYTES)),
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo autorizar la subida" }, { status: 400 });
  }
}
