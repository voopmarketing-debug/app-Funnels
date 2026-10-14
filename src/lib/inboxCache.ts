import { prisma } from "@/lib/prisma";

// The thread lists of Messenger and Instagram Direct, kept for a few seconds.
// Opening a conversation re-renders the whole page, and each render used to
// ask Meta for both lists again (80 conversations with their last messages):
// by far the slowest part of a click. The list is shared for 20 s; the
// messages of the open conversation are always read live.

const TTL_MS = 20_000;
const keyFor = (network: string) => `inbox:${network}`;

export async function cachedThreads<T>(businessId: string, network: string, load: () => Promise<T[]>): Promise<T[]> {
  const key = keyFor(network);
  const hit = await prisma.socialMetricCache.findUnique({ where: { businessId_key: { businessId, key } } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < TTL_MS) return hit.data as unknown as T[];
  const fresh = await load();
  // A failed read throws before this point, so errors are never cached.
  await prisma.socialMetricCache.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, data: fresh as object[], fetchedAt: new Date() },
    update: { data: fresh as object[], fetchedAt: new Date() },
  });
  return fresh;
}

/** After answering, so the list shows the reply right away. */
export async function clearInboxCache(businessId: string): Promise<void> {
  await prisma.socialMetricCache.deleteMany({ where: { businessId, key: { startsWith: "inbox:" } } });
}
