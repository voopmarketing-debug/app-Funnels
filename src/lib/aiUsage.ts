import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/aiCost";

/**
 * Per-client AI spend outside WhatsApp replies (those keep their usage on
 * Message — see aiCost.ts). The caller that knows which business a piece
 * of work is for wraps it in withAiUsage(); the provider wrappers deep
 * inside (website generator, diagnosis, tts, hero image) just call
 * recordAnthropicUsage / recordOpenAiUsage, without every generator having
 * to thread a businessId through. Outside a withAiUsage scope nothing is
 * recorded (e.g. the health check).
 */
export type AiUsageKind = "DIAGNOSIS" | "WEBSITE" | "VOICE_IN" | "VOICE_OUT" | "IMAGE";

type Scope = { businessId: string; kind: AiUsageKind };
const scope = new AsyncLocalStorage<Scope>();

export function withAiUsage<T>(businessId: string, kind: AiUsageKind, fn: () => Promise<T>): Promise<T> {
  return scope.run({ businessId, kind }, fn);
}

// OpenAI list prices (USD). whisper-1 bills per minute of audio, tts-1 per
// character, gpt-image-1 per token (text in / image out).
const WHISPER_PER_MINUTE = 0.006;
const TTS1_PER_CHAR = 15 / 1_000_000;
const GPT_IMAGE_TEXT_IN_PER_TOKEN = 5 / 1_000_000;
const GPT_IMAGE_OUT_PER_TOKEN = 40 / 1_000_000;
// When the images API doesn't report usage: a 1536x1024 medium image.
const GPT_IMAGE_FALLBACK = 0.063;

async function write(row: {
  kind?: AiUsageKind;
  provider: "anthropic" | "openai";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  units?: number;
  costUsd: number;
}): Promise<void> {
  const current = scope.getStore();
  if (!current) return;
  const { kind, ...data } = row;
  try {
    await prisma.aiUsage.create({ data: { businessId: current.businessId, kind: kind ?? current.kind, ...data } });
  } catch (err) {
    // Never let cost bookkeeping break the feature that just succeeded.
    console.error("Failed to record AI usage:", err);
  }
}

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export async function recordAnthropicUsage(model: string, usage: AnthropicUsage | undefined | null): Promise<void> {
  if (!usage) return;
  const tokens = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  };
  const costUsd =
    estimateCostUsd({
      model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cacheCreationInputTokens: tokens.cacheWriteTokens,
      cacheReadInputTokens: tokens.cacheReadTokens,
    }) ?? 0;
  await write({ provider: "anthropic", model, ...tokens, costUsd });
}

export async function recordTranscription(seconds: number): Promise<void> {
  await write({ kind: "VOICE_IN", provider: "openai", model: "whisper-1", units: seconds, costUsd: (seconds / 60) * WHISPER_PER_MINUTE });
}

export async function recordSpeech(characters: number): Promise<void> {
  await write({ kind: "VOICE_OUT", provider: "openai", model: "tts-1", units: characters, costUsd: characters * TTS1_PER_CHAR });
}

export async function recordImage(usage: { input_tokens?: number; output_tokens?: number } | undefined): Promise<void> {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const costUsd = usage
    ? inputTokens * GPT_IMAGE_TEXT_IN_PER_TOKEN + outputTokens * GPT_IMAGE_OUT_PER_TOKEN
    : GPT_IMAGE_FALLBACK;
  await write({ kind: "IMAGE", provider: "openai", model: "gpt-image-1", inputTokens, outputTokens, costUsd });
}
