import { describe, expect, it } from "vitest";
import { SectionSchema } from "./websiteContentV2";
import { AiSectionSchema, fromAiSection, toAiSection } from "./websiteAiFormat";
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

  it("fills safe defaults when the AI leaves optional fields null", () => {
    const ai = AiSectionSchema.parse({ type: "cta", heading: "Escríbenos hoy", items: [] });
    expect(fromAiSection(ai)).toEqual({ type: "cta", heading: "Escríbenos hoy", body: "", ctaLabel: "Escríbenos" });
  });
});
