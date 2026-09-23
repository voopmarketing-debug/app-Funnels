import { prisma } from "@/lib/prisma";

/**
 * DB-backed rate limiting — no external dependency (Redis/Upstash) needed
 * for the volume this app sees. Used to throttle login attempts and
 * password-reset requests, which had no limiting at all (see the cyber-neo
 * audit). Rows are small and short-lived; not pruned yet since volume is
 * low enough that it doesn't matter.
 */

/** True if `key` has already hit `maxEvents` recorded events within the last `windowMs`. Check this BEFORE doing the sensitive operation. */
export async function isRateLimited(key: string, maxEvents: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } });
  return count >= maxEvents;
}

/** Records one event against `key` — call after a failed login, or after any password-reset request, to count toward the window above. */
export async function recordRateLimitEvent(key: string): Promise<void> {
  await prisma.rateLimitAttempt.create({ data: { key } });
}
