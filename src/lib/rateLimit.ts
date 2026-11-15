import { prisma } from "@/lib/prisma";

/**
 * DB-backed rate limiting — no external dependency (Redis/Upstash) needed
 * for the volume this app sees. Used to throttle login attempts and
 * password-reset requests, which had no limiting at all (see the cyber-neo
 * audit). Rows are small and short-lived: old ones are deleted now and then
 * (see pruneRateLimitEvents), well after the longest window in use (35 days for the website AI limit, 3 days for the rest).
 */

const KEEP_EVENTS_MS = 3 * 24 * 60 * 60 * 1000;
// Keys that count over a whole month (see websiteGenerationLimit.ts) are kept longer.
const LONG_KEEP_PREFIX = "website-gen:";
const LONG_KEEP_EVENTS_MS = 35 * 24 * 60 * 60 * 1000;
const PRUNE_ONE_IN = 50;

/** Deletes events older than any window that is still being checked. */
export async function pruneRateLimitEvents(): Promise<number> {
  const now = Date.now();
  const { count } = await prisma.rateLimitAttempt.deleteMany({
    where: {
      OR: [
        { createdAt: { lt: new Date(now - KEEP_EVENTS_MS) }, NOT: { key: { startsWith: LONG_KEEP_PREFIX } } },
        { createdAt: { lt: new Date(now - LONG_KEEP_EVENTS_MS) } },
      ],
    },
  });
  return count;
}

/** True if `key` has already hit `maxEvents` recorded events within the last `windowMs`. Check this BEFORE doing the sensitive operation. */
export async function isRateLimited(key: string, maxEvents: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } });
  return count >= maxEvents;
}

/** How many events `key` has recorded since `since`. */
export async function countRateLimitEvents(key: string, since: Date): Promise<number> {
  return prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } });
}

/** Records one event against `key` — call after a failed login, or after any password-reset request, to count toward the window above. */
export async function recordRateLimitEvent(key: string): Promise<void> {
  await prisma.rateLimitAttempt.create({ data: { key } });
  // Housekeeping on roughly 1 in 50 writes, never blocking or failing the caller.
  if (Math.random() < 1 / PRUNE_ONE_IN) void pruneRateLimitEvents().catch(() => {});
}
