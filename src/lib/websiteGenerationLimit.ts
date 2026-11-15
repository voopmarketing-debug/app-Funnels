import { countRateLimitEvents, recordRateLimitEvent } from "@/lib/rateLimit";

// Every AI call this feature makes — creating a page, regenerating one, or
// applying a free-text AI edit (see parseWebsiteContent in
// lib/websiteGenerator.ts) — hits the Anthropic API the same way, so they
// all count against one shared cap. Purely a cost guardrail; not a billing
// feature, so one flat limit for everyone rather than per-plan tiering. Counts
// per calendar month (Bogotá time) and reuses the DB-backed rate limiter
// (lib/rateLimit.ts), which keeps these events for 35 days.
export const MONTHLY_WEBSITE_GENERATION_LIMIT = 4;

// Bogotá has no daylight saving: always UTC-5.
const BOGOTA_OFFSET_HOURS = 5;

/** When the current calendar month (Bogotá) started and when the next one starts, as instants. */
export function monthWindow(now: Date): { start: Date; nextStart: Date } {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1, BOGOTA_OFFSET_HOURS)), nextStart: new Date(Date.UTC(y, m + 1, 1, BOGOTA_OFFSET_HOURS)) };
}

function rateLimitKey(businessId: string): string {
  return `website-gen:${businessId}`;
}

/** Throws a client-readable error if this business already used this month's AI changes — call before spending an AI call. */
export async function assertWebsiteGenerationAllowed(businessId: string, now: Date = new Date()): Promise<void> {
  const { start, nextStart } = monthWindow(now);
  const used = await countRateLimitEvents(rateLimitKey(businessId), start);
  if (used >= MONTHLY_WEBSITE_GENERATION_LIMIT) {
    const renews = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(nextStart);
    throw new Error(
      `Ya usaste los ${MONTHLY_WEBSITE_GENERATION_LIMIT} cambios con IA de este mes para este negocio. Se renuevan el ${renews}. Mientras tanto puedes editar el sitio a mano.`,
    );
  }
}

/** Logs one successful AI call toward this business's monthly cap — call only after the Anthropic call succeeds. */
export async function recordWebsiteGeneration(businessId: string): Promise<void> {
  await recordRateLimitEvent(rateLimitKey(businessId));
}
