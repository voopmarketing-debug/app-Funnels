import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { renewalNotice } from "@/lib/renewal";
import { NotificationBell, type NotificationItem } from "./NotificationBell";
import { RenewalBanner } from "./RenewalBanner";

// The pieces of the panel's frame that are not needed to show the page itself (the bell with its
// notifications, the "Tu plan vence" banner, the unread badge). They load on their own while the
// rest of the page is already on screen, instead of making a phone wait for all of them first.

function formatNotificationDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

/** Read once per request even though the bell is drawn twice (phone top bar and desktop header). */
const loadNotifications = cache(async (userId: string): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
  // Every business this user has any access to (owner, agency, or invited teammate).
  const businessIds = (await prisma.membership.findMany({ where: { userId }, select: { businessId: true } })).map((m) => m.businessId);
  if (businessIds.length === 0) return { notifications: [], unreadCount: 0 };
  const [rows, count] = await Promise.all([
    prisma.notification.findMany({ where: { businessId: { in: businessIds } }, orderBy: { createdAt: "desc" }, take: 20, include: { business: { select: { name: true } } } }),
    prisma.notification.count({ where: { businessId: { in: businessIds }, readAt: null } }),
  ]);
  const notifications = rows.map((n) => ({
    id: n.id,
    message: n.message,
    createdAt: formatNotificationDate(n.createdAt),
    read: n.readAt !== null,
    // Appointment notifications point straight at the conversation; metric alerts have no single
    // conversation, so they go to the KPIs page; stock alerts go to Inventario.
    href: n.conversationId
      ? `/dashboard/businesses/${n.businessId}/conversations/${n.conversationId}`
      : n.type === "LOW_STOCK" || n.type === "OUT_OF_STOCK"
        ? `/dashboard/businesses/${n.businessId}/inventario`
        : `/dashboard/businesses/${n.businessId}/analytics`,
    businessName: n.business.name,
  }));
  return { notifications, unreadCount: count };
});

export async function NotificationBellLoader({ userId }: { userId: string }) {
  const { notifications, unreadCount } = await loadNotifications(userId).catch(() => ({ notifications: [], unreadCount: 0 }));
  return <NotificationBell notifications={notifications} unreadCount={unreadCount} />;
}

/** Same size as the bell, shown while it loads. */
export function BellPlaceholder() {
  return <span aria-hidden="true" className="inline-block h-9 w-9" />;
}

export async function RenewalLoader({ userId }: { userId: string }) {
  const notice = await renewalNotice(userId).catch(() => null);
  return notice ? <RenewalBanner daysLeft={notice.daysLeft} expired={notice.expired} /> : null;
}

/** Chats of a business with a customer message nobody has opened yet (customer messages newer than the chat's lastReadAt, last 60 days). A badge is never worth breaking the panel over: any failure counts as zero. */
export async function countUnreadChats(businessId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  try {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "Conversation" c
      WHERE c."businessId" = ${businessId}
        AND EXISTS (
          SELECT 1 FROM "Message" m
          WHERE m."conversationId" = c.id AND m."role" = 'CUSTOMER' AND m."createdAt" >= ${since}
            AND (c."lastReadAt" IS NULL OR m."createdAt" > c."lastReadAt")
        )`;
    return rows[0]?.n ?? 0;
  } catch (err) {
    console.error("Failed to count unread chats:", err);
    return 0;
  }
}
