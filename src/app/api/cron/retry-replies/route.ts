import { retryPendingReplies } from "@/lib/replyRecovery";
import { safeEqual } from "@/lib/crypto";

// Retries every business's unanswered WhatsApp chats (see lib/replyRecovery.ts).
// Meant to be called every few minutes by an external scheduler (e.g.
// cron-job.org) with `Authorization: Bearer $CRON_SECRET` — Vercel Hobby
// crons can only run once a day. The same recovery also runs on every
// webhook delivery and CRM poll, so this is the backstop for quiet periods.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await retryPendingReplies({ limit: 50 }));
}
