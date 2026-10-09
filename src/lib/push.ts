import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push (the notifications that pop up on a computer or phone even with
// the app closed). The VAPID key pair identifies this app to the browsers'
// push services; it's generated once and kept in AppSetting, so there's no
// environment variable to set up.
const VAPID_KEY = "vapid_keys";

type VapidKeys = { publicKey: string; privateKey: string };

let cached: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: VAPID_KEY } });
  if (row) {
    cached = JSON.parse(row.value) as VapidKeys;
    return cached;
  }
  const fresh = webpush.generateVAPIDKeys();
  try {
    await prisma.appSetting.create({ data: { key: VAPID_KEY, value: JSON.stringify(fresh) } });
    cached = fresh;
  } catch {
    // Another request created them first: use those.
    const winner = await prisma.appSetting.findUniqueOrThrow({ where: { key: VAPID_KEY } });
    cached = JSON.parse(winner.value) as VapidKeys;
  }
  return cached;
}

// Only the browsers' own push services: the server POSTs to a subscription's
// endpoint every time it notifies, so it must never point anywhere else.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to every device of these users; forgets devices the push service no longer knows. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  const subs = (await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } })).filter((s) => isPushServiceUrl(s.endpoint));
  if (subs.length === 0) return;
  const keys = await getVapidKeys();
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject: `https://${host}`, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60,
          urgency: "high",
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[push] send failed", status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
}

/**
 * Notifies the business's own people (owner and team), not the agency's
 * admin account — the agency sees every client and would be flooded.
 */
export async function sendPushToBusiness(businessId: string, payload: PushPayload): Promise<void> {
  const members = await prisma.membership.findMany({
    where: { businessId, role: { in: ["OWNER", "MEMBER"] } },
    select: { userId: true },
  });
  await sendPushToUsers(
    members.map((m) => m.userId),
    payload,
  );
}
