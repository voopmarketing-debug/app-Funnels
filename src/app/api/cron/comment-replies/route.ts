import { sweepCommentAutoReplies } from "@/lib/commentAutoReply";
import { safeEqual } from "@/lib/crypto";

// Keyword auto-replies for comments Meta's webhook didn't deliver (see
// lib/commentAutoReply.ts). Called every 10 minutes by the GitHub scheduled
// job with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  const authorization = request.headers.get("authorization");
  if (!authorization || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sweepCommentAutoReplies());
}
