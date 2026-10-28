import { runDayBeforeReminders } from "@/lib/appointmentDayBefore";
import { runBookingLinkFollowUps } from "@/lib/bookingLinkFollowUp";
import { safeEqual } from "@/lib/crypto";

// Vercel Cron (see vercel.json): once a day, in the afternoon Colombia time.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" on its own cron calls,
// the same check as api/cron/metric-alerts. The Hobby plan allows two cron
// jobs, so the daily WhatsApp work shares this one: the day-before reminders
// first, then the booking-link follow-up (only for businesses that turned it on).
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the daily WhatsApp jobs.");
    return new Response("Not configured", { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Each job on its own: one failing must not stop the other.
  const dayBefore = await runDayBeforeReminders().catch((err) => {
    console.error("[day-before] run failed:", err instanceof Error ? err.message : err);
    return null;
  });
  const followUp = await runBookingLinkFollowUps().catch((err) => {
    console.error("[booking-link] run failed:", err instanceof Error ? err.message : err);
    return null;
  });
  if (dayBefore) console.info(`[day-before] checked=${dayBefore.checked} sent=${dayBefore.sent} needsTemplate=${dayBefore.needsTemplate} failed=${dayBefore.failed}`);
  if (followUp) console.info(`[booking-link] businesses=${followUp.businesses} checked=${followUp.checked} sent=${followUp.sent} needsTemplate=${followUp.needsTemplate} failed=${followUp.failed}`);
  return Response.json({ dayBefore, followUp });
}
