import { NextRequest, NextResponse } from "next/server";
import { registerBroadcastClick } from "@/lib/broadcastTracking";

// The tracked link embedded in a broadcast message when it has a ctaUrl —
// logs who clicked (see registerBroadcastClick), then redirects to the real
// destination. The target is always resolved server-side from the
// broadcast's own stored ctaUrl, never a client-supplied URL, so this can't
// be used as an open redirect.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ broadcastId: string; conversationId: string }> },
) {
  const { broadcastId, conversationId } = await params;
  const target = await registerBroadcastClick(broadcastId, conversationId);
  if (!target) {
    return new NextResponse("Enlace no encontrado", { status: 404 });
  }
  return NextResponse.redirect(target, { status: 302 });
}
