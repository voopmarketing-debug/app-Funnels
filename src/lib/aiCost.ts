// Real per-token USD pricing for the models this app calls (src/lib/ai.ts
// for replies, src/lib/diagnosis.ts for the sales diagnosis). Anthropic
// prices per million tokens — these are per single token, ready to multiply
// straight against the raw counts stored on Message. Update this table if
// pricing changes or a new model is ever wired in.
//
// Cache-write tokens are priced at the 1-hour-TTL rate (2x input), not the
// default 5-minute rate (1.25x), because every cache_control breakpoint in
// this app uses ttl: "1h" (see buildSystemPrompt in ai.ts) — if that TTL
// ever changes, this multiplier needs to change with it. Cache-read tokens
// are 0.1x input regardless of which TTL wrote them.
type ModelPricing = { input: number; output: number; cacheWrite: number; cacheRead: number };

const PER_MILLION = 1_000_000;

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-5": {
    input: 2 / PER_MILLION,
    output: 10 / PER_MILLION,
    cacheWrite: (2 / PER_MILLION) * 2,
    cacheRead: (2 / PER_MILLION) * 0.1,
  },
  "claude-opus-5": {
    input: 5 / PER_MILLION,
    output: 25 / PER_MILLION,
    cacheWrite: (5 / PER_MILLION) * 2,
    cacheRead: (5 / PER_MILLION) * 0.1,
  },
};

export type MessageUsage = {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
};

// Returns null when the model is unrecognized or unset (older messages from
// before this tracking existed, or a model not in the table above) — the
// caller decides how to represent "no data" rather than silently costing it
// as zero.
export function estimateCostUsd(usage: MessageUsage): number | null {
  if (!usage.model) return null;
  const pricing = MODEL_PRICING[usage.model];
  if (!pricing) return null;

  return (
    (usage.inputTokens ?? 0) * pricing.input +
    (usage.outputTokens ?? 0) * pricing.output +
    (usage.cacheCreationInputTokens ?? 0) * pricing.cacheWrite +
    (usage.cacheReadInputTokens ?? 0) * pricing.cacheRead
  );
}
