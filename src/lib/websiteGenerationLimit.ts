import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";

// Every AI call this feature makes — creating a page, regenerating one, or
// applying a free-text AI edit (see parseWebsiteContent in
// lib/websiteGenerator.ts) — hits the Anthropic API the same way, so they
// all count against one shared cap. Purely a cost guardrail against a
// client mashing "Generar"/"Regenerar" repeatedly; not a billing feature,
// so one flat limit for everyone rather than per-plan tiering. Reuses the
// same DB-backed rate limiter as login/password-reset (lib/rateLimit.ts)
// instead of a bespoke table.
export const DAILY_WEBSITE_GENERATION_LIMIT = 15;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function rateLimitKey(businessId: string): string {
  return `website-gen:${businessId}`;
}

/** Throws a client-readable error if this business already hit today's cap — call before spending an AI call. */
export async function assertWebsiteGenerationAllowed(businessId: string): Promise<void> {
  const limited = await isRateLimited(rateLimitKey(businessId), DAILY_WEBSITE_GENERATION_LIMIT, WINDOW_MS);
  if (limited) {
    throw new Error(
      `Llegaste al límite diario de ${DAILY_WEBSITE_GENERATION_LIMIT} generaciones o ediciones con IA para este negocio. Vuelve a intentarlo en unas horas, o edita el sitio manualmente mientras tanto.`,
    );
  }
}

/** Logs one successful AI call toward this business's daily cap — call only after the Anthropic call succeeds. */
export async function recordWebsiteGeneration(businessId: string): Promise<void> {
  await recordRateLimitEvent(rateLimitKey(businessId));
}
