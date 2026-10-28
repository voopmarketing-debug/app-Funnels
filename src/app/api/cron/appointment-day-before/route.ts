import { runDayBeforeReminders } from "@/lib/appointmentDayBefore";
import { safeEqual } from "@/lib/crypto";

// Vercel Cron (see vercel.json): once a day, in the afternoon Colombia time.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" on its own cron calls,
// the same check as api/cron/metric-alerts.
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the day-before reminders.");
    return new Response("Not configured", { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runDayBeforeReminders();
  console.info(`[day-before] checked=${result.checked} sent=${result.sent} needsTemplate=${result.needsTemplate} failed=${result.failed}`);
  return Response.json(result);
}
