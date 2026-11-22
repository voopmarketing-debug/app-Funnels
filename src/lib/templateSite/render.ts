import type { CatalogProduct } from "@/lib/websiteContentV2";
import { TemplateSiteSchema, type TemplateSiteContent } from "./content";
import { renderShowroom } from "./showroom";
import { renderStory } from "./story";

export type TemplateRenderCtx = {
  businessName: string;
  trackingBasePath: string;
  preview?: boolean;
  leadSubmitted?: boolean;
  products: CatalogProduct[];
};

export function renderTemplateSite(content: TemplateSiteContent, ctx: TemplateRenderCtx): string {
  return content.template === "showroom" ? renderShowroom(content, ctx) : renderStory(content, ctx);
}

/** Stored JSON → typed content, or null when it does not fit (an older or damaged page). */
export function parseTemplateSite(value: unknown): TemplateSiteContent | null {
  const parsed = TemplateSiteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
