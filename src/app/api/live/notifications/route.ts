import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Polled every few seconds by NotificationSoundPoller. A plain GET route,
// NOT a Server Action: Server Actions share the router's queue with page
// navigations, so a slow poll in flight made menu taps wait (the "stuck
// until I refresh" bug). Fetches to a route handler run independently.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const businessIds = (
    await prisma.membership.findMany({ where: { userId: session.user.id }, select: { businessId: true } })
  ).map((m) => m.businessId);
  const count = businessIds.length
    ? await prisma.notification.count({ where: { businessId: { in: businessIds }, readAt: null } })
    : 0;
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
