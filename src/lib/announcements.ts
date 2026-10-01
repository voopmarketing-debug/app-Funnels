import { prisma } from "@/lib/prisma";

export type AnnouncementKind = "BANNER" | "NEWS";

/** Published announcements inside their (optional) live window, in display order. */
export async function getLiveAnnouncements() {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      published: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Links in announcements are typed by the agency into a free-text field and
 * rendered as <a href> for every client — only https URLs and in-app paths
 * are allowed, so a "javascript:" link can never ride along.
 */
export function safeAnnouncementUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  if (/^\/(?!\/)[^\s]*$/.test(trimmed)) return trimmed;
  return null;
}
