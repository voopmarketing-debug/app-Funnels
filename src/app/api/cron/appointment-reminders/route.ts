import { runAppointmentReminders } from "@/lib/agendaReminders";
import { safeEqual } from "@/lib/crypto";

// Triggered by an EXTERNAL scheduler (e.g. cron-job.org), not Vercel's own
// Cron — this needs to run every 5-10 minutes for "1 hour before" reminders
// to land on time, and Vercel's Hobby plan only allows cron jobs once a
// day. Same CRON_SECRET / Authorization: Bearer check as
// api/cron/metric-alerts, so this route is just as protected even though
// nothing inside Vercel is the one calling it.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run appointment reminders.");
    return new Response("Not configured", { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runAppointmentReminders();
  return Response.json(result);
}
