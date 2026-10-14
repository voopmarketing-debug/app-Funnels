import { describe, expect, it } from "vitest";
import { SectionSchema } from "./websiteContentV2";
import { AiSectionSchema, fromAiSection, keepKnownImages, toAiSection } from "./websiteAiFormat";
import fixtures from "./websiteAiFormat.fixtures.json";

const sections = fixtures.map((f) => SectionSchema.parse(f));

describe("websiteAiFormat", () => {
  it("covers every section type", () => {
    expect(new Set(sections.map((s) => s.type)).size).toBe(15);
  });

  it.each(sections.map((s) => [s.type, s] as const))("round-trips %s through the AI format unchanged", (_type, section) => {
    const ai = AiSectionSchema.parse(toAiSection(section));
    expect(fromAiSection(ai)).toEqual(section);
  });

  it("keeps the photos of a section through the AI format", () => {
    const withPhotos = { ...sections.find((s) => s.type === "features")!, image: "https://cdn.example.com/a.jpg", bgImage: "https://cdn.example.com/b.jpg" };
    expect(fromAiSection(AiSectionSchema.parse(toAiSection(withPhotos)))).toEqual(withPhotos);
  });

  it("drops photos that are not the business's own (the AI can't invent urls)", () => {
    const section = { ...sections[0], image: "https://evil.example.com/x.jpg", bgImage: "https://cdn.example.com/b.jpg" };
    const kept = keepKnownImages(section, new Set(["https://cdn.example.com/b.jpg"]));
    expect(kept).toMatchObject({ bgImage: "https://cdn.example.com/b.jpg" });
    expect(kept).not.toHaveProperty("image");
    expect(keepKnownImages(section, new Set())).not.toHaveProperty("bgImage");
  });

  it("fills safe defaults when the AI leaves optional fields null", () => {
    const ai = AiSectionSchema.parse({ type: "cta", heading: "Escríbenos hoy", items: [] });
    expect(fromAiSection(ai)).toEqual({ type: "cta", heading: "Escríbenos hoy", body: "", ctaLabel: "Escríbenos" });
  });
});
