import { prisma } from "@/lib/prisma";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

/**
 * The small "eyebrow" label above the hero heading (see
 * lib/websiteTemplate.ts) and the photo for the hero — both computed
 * server-side at render time, not by the AI, so the eyebrow costs nothing
 * extra and the image never needs a live API call on every page view.
 *
 * Image priority: (1) a real photo the business uploaded themselves
 * (AgentMedia) — always wins, since an authentic photo of the actual
 * business beats a generated one; (2) aiImageUrl, the one-time AI-generated
 * photo made for this specific page at creation/regeneration time (see
 * lib/websiteHeroImage.ts and actions.ts) — never a shared stock photo, so
 * two businesses in the same industry don't end up with the same image;
 * (3) no image — the hero just stays text-only, same as funnelslabs.app's
 * own hero, until either of the above exists.
 */
export async function getWebsiteHeroContext(
  businessId: string,
  industry: string,
  aiImageUrl?: string | null,
): Promise<{ eyebrow: string | null; heroImageUrl: string | null }> {
  const eyebrow = INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? null;
  const photo = await prisma.agentMedia.findFirst({
    where: { businessId, mediaType: "image" },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });

  return { eyebrow, heroImageUrl: photo?.url ?? aiImageUrl ?? null };
}
