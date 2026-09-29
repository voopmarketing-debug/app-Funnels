import { runMetricAlerts } from "@/lib/metricAlerts";
import { runAllWhatsAppHealthChecks } from "@/lib/whatsappHealth";
import { safeEqual } from "@/lib/crypto";

// Triggered once a day by Vercel Cron (see vercel.json). Vercel
// automatically sends `Authorization: Bearer $CRON_SECRET` on cron-invoked
// requests when that env var is set in the project — verified below so this
// route can't be triggered by anyone who finds the URL.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run metric alerts.");
    return new Response("Not configured", { status: 500 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Same daily run also checks every WhatsApp connection (token, number,
  // webhook subscription) and alerts the owner when one breaks.
  const [result, whatsappHealth] = await Promise.all([runMetricAlerts(), runAllWhatsAppHealthChecks()]);
  return Response.json({ ...result, whatsappHealth });
}
