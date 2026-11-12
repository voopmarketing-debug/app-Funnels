import { runRenewalReminders } from "@/lib/renewalReminders";
import { safeEqual } from "@/lib/crypto";

// Called by the scheduled job (.github/workflows/scheduled-jobs.yml) with the
// same CRON_SECRET bearer check as the other cron routes. Each reminder goes
// out once per paid period, so running it every few minutes is harmless.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run renewal reminders.");
    return new Response("Not configured", { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(await runRenewalReminders());
}
