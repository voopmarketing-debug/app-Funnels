import { prisma } from "@/lib/prisma";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

/**
 * The small "eyebrow" label above the hero heading (see
 * lib/websiteTemplate.ts) and, when the business has uploaded one, a real
 * photo for the hero — both computed server-side at render time, not by the
 * AI, so they cost nothing extra and always reflect the business's current
 * state (a newly uploaded photo shows up on the next page load, no
 * regeneration needed).
 *
 * heroImageUrl deliberately never falls back to a generic stock photo: this
 * app generates pages for many paying clients, and a shared stock image
 * would mean every "clínica" (say) shows the identical photo — worse than
 * no photo. The hero just stays text-only (same as funnelslabs.app's own
 * hero) until the client uploads something real via "Multimedia".
 */
export async function getWebsiteHeroContext(
  businessId: string,
  industry: string,
): Promise<{ eyebrow: string | null; heroImageUrl: string | null }> {
  const eyebrow = INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? null;
  const photo = await prisma.agentMedia.findFirst({
    where: { businessId, mediaType: "image" },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });

  return { eyebrow, heroImageUrl: photo?.url ?? null };
}
