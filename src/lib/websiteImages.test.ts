import { describe, expect, it } from "vitest";
import { NICHES, buildNicheContent } from "./websiteNicheTemplates";
import { AI_IMAGES_PER_PAGE, aiImagesInUse, applyGeneratedImages, imagePrompt, planImageSlots, removeAiImages } from "./websiteImages";

const content = () => buildNicheContent({ niche: NICHES[2], index: 0 }, { businessName: "Clínica Sol" });

describe("AI images", () => {
  it("plans at most five slots: the cover first, then soft backgrounds", () => {
    const slots = planImageSlots(content());
    expect(slots.length).toBeGreaterThan(1);
    expect(slots.length).toBeLessThanOrEqual(AI_IMAGES_PER_PAGE);
    expect(slots[0]).toEqual({ index: 0, field: "image", kind: "hero" });
    expect(slots.slice(1).every((s) => s.field === "bgImage" && s.kind === "ambient")).toBe(true);
    expect(planImageSlots(content(), 2)).toHaveLength(2);
    expect(planImageSlots(content(), 0)).toHaveLength(0);
  });

  it("skips slots that already have a picture and never plans the host (people)", () => {
    const c = content();
    (c.sections[0] as { image: string | null }).image = "https://x.test/mine.jpg";
    const slots = planImageSlots(c);
    expect(slots.some((s) => s.kind === "hero")).toBe(false);
    for (const s of slots) expect(c.sections[s.index].type).not.toBe("host");
  });

  it("prompts show scenes and objects, never people, for every niche", () => {
    for (const n of NICHES) {
      for (const kind of ["hero", "ambient"] as const) {
        const p = imagePrompt(kind, { businessName: "X", industryLabel: "salud", nicheId: n.id });
        expect(p).toMatch(/Sin personas/);
        expect(p).not.toMatch(/\b(paciente|cliente|equipo|antes y después|retrato)\b/i);
      }
    }
    expect(imagePrompt("hero", { businessName: "X", industryLabel: "restaurante", nicheId: null })).toMatch(/restaurante/);
  });

  it("remembers the AI pictures, counts the ones still used and removes only them", () => {
    const c = content();
    const slots = planImageSlots(c);
    const placed = slots.map((slot, i) => ({ slot, url: `https://x.test/ai${i}.png` }));
    const withAi = applyGeneratedImages(c, placed);
    expect(aiImagesInUse(withAi)).toBe(slots.length);
    // The owner swaps the cover for their own photo: it no longer counts as AI.
    (withAi.sections[0] as { image: string | null }).image = "https://x.test/mine.jpg";
    expect(aiImagesInUse(withAi)).toBe(slots.length - 1);
    const cleaned = removeAiImages(withAi);
    expect((cleaned.sections[0] as { image: string | null }).image).toBe("https://x.test/mine.jpg");
    expect(aiImagesInUse(cleaned)).toBe(0);
    expect(cleaned.sections.every((s) => !s.bgImage)).toBe(true);
  });
});
