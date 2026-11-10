import { retryPendingReplies } from "@/lib/replyRecovery";
import { runDueAutomations } from "@/lib/automations/engine";
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
  const retried = await retryPendingReplies({ limit: 50 });
  // The same scheduler also continues the pauses of conversation flows (lib/automations).
  const flows = await runDueAutomations({ limit: 25 }).catch((err) => {
    console.error("[flows] due run failed:", err instanceof Error ? err.message : err);
    return null;
  });
  return Response.json({ ...retried, flows });
}
