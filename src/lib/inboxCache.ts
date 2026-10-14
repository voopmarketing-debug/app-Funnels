import { after } from "next/server";
import { prisma } from "@/lib/prisma";

// The thread lists of Messenger and Instagram Direct. Meta's Conversations API
// is slow (30 s or more for a busy Page), and opening a conversation re-renders
// the whole page, so the lists are served from here and refreshed behind the
// scenes (stale-while-revalidate):
//  - younger than FRESH_MS: served as is;
//  - older, up to STALE_MS: served at once, and re-read from Meta after the
//    response (the next visit or the 30 s poll sees the new data);
//  - nothing saved (the very first visit): read from Meta and waited for.
// The messages of the open conversation are always read live.

const FRESH_MS = 20_000;
const STALE_MS = 12 * 60 * 60 * 1000;
const keyFor = (network: string) => `inbox:${network}`;

// One background refresh per list at a time on this server instance.
const refreshing = new Set<string>();

async function store<T>(businessId: string, key: string, data: T[]): Promise<void> {
  await prisma.socialMetricCache.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, data: data as object[], fetchedAt: new Date() },
    update: { data: data as object[], fetchedAt: new Date() },
  });
}

export async function cachedThreads<T>(businessId: string, network: string, load: () => Promise<T[]>): Promise<T[]> {
  const key = keyFor(network);
  const hit = await prisma.socialMetricCache.findUnique({ where: { businessId_key: { businessId, key } } });
  const age = hit ? Date.now() - hit.fetchedAt.getTime() : Infinity;
  if (hit && age < FRESH_MS) return hit.data as unknown as T[];

  if (hit && age < STALE_MS) {
    const lock = `${businessId}:${key}`;
    if (!refreshing.has(lock)) {
      refreshing.add(lock);
      after(async () => {
        try {
          await store(businessId, key, await load());
        } catch (err) {
          // Keep the old list; the next visit tries again.
          console.error("[social inbox] background refresh failed", network, err);
        } finally {
          refreshing.delete(lock);
        }
      });
    }
    return hit.data as unknown as T[];
  }

  // A failed read throws before storing, so errors are never cached.
  const fresh = await load();
  await store(businessId, key, fresh);
  return fresh;
}

/**
 * After answering: the saved lists stay usable (so the page still opens at
 * once) but count as old, so they are re-read from Meta behind the scenes.
 */
export async function invalidateInboxCache(businessId: string): Promise<void> {
  await prisma.socialMetricCache.updateMany({
    where: { businessId, key: { startsWith: "inbox:" } },
    data: { fetchedAt: new Date(Date.now() - 2 * FRESH_MS) },
  });
}
