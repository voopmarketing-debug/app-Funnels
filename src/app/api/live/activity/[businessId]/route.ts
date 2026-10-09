import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { maybeRetryPendingReplies } from "@/lib/replyRecovery";
import { maybeRunAppointmentReminders } from "@/lib/agendaReminders";

// Polled every few seconds by CrmLivePoller while the CRM is open. A plain
// GET route instead of a Server Action so it never blocks page navigation
// (see app/api/live/notifications/route.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // While someone has the CRM open, this poll also nudges the unanswered-
  // chat recovery for this business (throttled to once a minute, runs after
  // the response so the poll stays fast).
  after(() => maybeRetryPendingReplies([businessId]).catch((err) => console.error("Reply recovery (poll) failed:", err)));
  after(() => maybeRunAppointmentReminders().catch((err) => console.error("Appointment reminders (poll) failed:", err)));

  const result = await prisma.conversation.aggregate({
    where: { businessId },
    _max: { lastMessageAt: true },
    _count: { _all: true },
  });
  return NextResponse.json(
    { signature: `${result._count._all}:${result._max.lastMessageAt?.getTime() ?? 0}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
